/**
 *  @file       standaloneWorker.js     A Node module which implements the class standaloneWorker,
 *                                      which knows how to execute jobs over the network in a
 *                                      standalone worker.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       March 2018
 */
"use strict";
var dcpConfig = global.dcpConfig || require('dcp/dcp-config');
var debugging;

/** Module configuration parameters. May be altered at runtime. Should be altered
 *  before first Worker is instantiated.
 */
exports.config = {
  debug: true
}
if (dcpConfig.inetDaemon) { /* full DCP install */
  exports.config.hostname = dcpConfig.inetDaemon.standaloneWorker.net.location.hostname;
  exports.config.location = dcpConfig.inetDaemon.standaloneWorker.net.location.port;
  debugging = require('dcp/debugging').scope('worker', exports.config);
} else {
  debugging = () => exports.config;
}
exports.config = Object.assign(exports.config, {
  hostname: 'localhost',
  port: 9000,
  connectBackoff: 10 * 1000, // start: 10s
  backoffMax: 5 * 60 * 1000, // max: 5 minutes
  backoffFactor: 1.1         // each fail, back off by 10%
}, dcpConfig.standaloneWorker || {});

/** Worker constructor
 *  @param      code            The code to run in the worker to bootstrap it (setup comms with Supervisor)
 *  @param      options         Options for the Worker constructor.  These can be options per the specification
 *                              for Web Workers (note: not current propagated) or any of these options:
 *
 *                              hostname:     The hostname of the Evaluator server; default to exports.config.hostname or localhost.
 *                              port:         The port number of the Evaluator server; default to exports.config.port or 9000;
 *                              readStream:   An instance of Stream.readable connected to an Evaluator
 *                              writeStream:  An instance of Stream.writeable connected to the same Evaluator, default=readStream
 *
 *  @returns an object with the following
 *  - methods:
 *    . addEventListener
 *    . removeEventListener
 *    . postMessage
 *    . terminate
 *    . create
 *  - properties:
 *    . onmessage
 *    . onerror
 *    . serial                  sequence number
 *    . serialize               current serialization function
 *    . deserialize             current deserialization function
 *  - events:
 *    . error
 *    . message
 */
exports.Worker = function standaloneWorker$$Worker (code, options) {
  var hostname, port;
  var readStream, writeStream;
  var ee = new (require('events').EventEmitter)()
  var pendingWrites = []
  var readBuf = ''
  var connected = false
  var dieTimer
  var shutdown;
  var connectTimer = false;
  
  if (typeof options === 'string') {
    options = { hostname: arguments[1], port: arguments[2] }
  }

  if (typeof options === 'object' && options.readStream) {
    debugging('lifecycle') && console.debug('Connecting via supplied streams');
    readStream = options.readStream;
    writeStream = options.writeStream || options.readStream;
    delete options.readStream;
    delete options.writeStream;
  }
  
  if (!readStream) {
    /* No supplied streams - reach and connect over TCP/IP */
    let socket = readStream = writeStream = new (require('net')).Socket();
    ({ hostname, port } =  exports.config);
    debugging('lifecycle') && console.debug('Connecting to', hostname + ':' + port);
    socket.on('connect', finishConnect.bind(this));
    startConnecting();
    delete options.hostname;
    delete options.port;
  } else {
    finishConnect.bind(this)();
  }
  
  this.addEventListener = ee.addListener.bind(ee)
  this.removeEventListener = ee.removeListener.bind(ee)
  this.serial = exports.Worker.lastSerial = (exports.Worker.lastSerial || 0) + 1
  this.serialize = JSON.stringify
  this.deserialize = JSON.parse

  function finishConnect () {
    if (connectTimer) {
      clearTimeout(connectTimer);
    }
    
    let wrappedMessage = this.serialize(
      { type: 'initWorker', w: this.serial, ts: Date.now(), payload: code, origin: 'workerBootstrap' }
    ) + '\n'
    connected = true

    readStream.setEncoding('utf-8');
    writeStream.setEncoding('utf-8');
    debugging() && console.debug('Connected ' + pendingWrites.length + ' pending messages.');

    /* We buffer writes in pendingWrites between the call to connect() and
     * the actual establishment of the TCP socket. Once connected, we drain that
     * buffer into the write buffer in Node's net module.  We still, however,
     * emit the initialization code first; the other writes will be postMessage etc
     */
    writeStream.write(wrappedMessage);
    while (pendingWrites.length && !writeStream.destroyed) {
      writeStream.write(pendingWrites.shift());
    }

    /* @todo Make this auto-detected /wg jul 2018
     * changeSerializer.bind(this)("/var/dcp/lib/serialize.js")
     */
  }

  /** Change the protocol's serialization implementation. Must be in
   *  a format which returns an 'exports' object on evaluation that
   *  has serialize and deserialize methods that are call-compatible
   *  with JSON.stringify and JSON.parse.
   *
   *  @param   filename     The path to the serialization module, or an exports object
   *  @param   charset      [optional]   The character set the code is stored in
   */
  this.changeSerializer = (filename, charset) => {
    if (this.newSerializer) {
      throw new Error('Outstanding serialization change on worker #' + this.serial)
    }

    try {
      let code
      let expo = filename

      if (typeof filename === 'object') {
        let expo = filename
        code = '({ serialize:' + expo.serialize + ',deserialize:' + expo.deserialize + '})'
      } else {
        code = require('fs').readFileSync(filename, charset || 'utf-8')
      }
      this.newSerializer = eval(code)
      if (typeof this.newSerializer !== 'object') {
        throw new TypeError('newSerializer code evaluated as ' + typeof this.newSerializer)
      }
      writeStream.write(this.serialize({ type: 'newSerializer', payload: code }) + '\n');
      this.serialize = this.newSerializer.serialize /* do not change deserializer until worker acknowledges change */
    } catch (e) {
      console.log('Cannot change serializer', e)
    }
  }

  /* Receive data from the network, turning it into debug output,
   * remote exceptions, worker messages, etc.
   */
  readStream.on('data', function standaloneWorker$$Worker$recvData (data) {
    var line, lineObj /* line of data coming over the network */
    var nl
    readBuf += data
    while ((nl = readBuf.indexOf('\n')) !== -1) {
      try {
        line = readBuf.slice(0, nl)
        readBuf = readBuf.slice(nl + 1)
        if (!line.length) { continue }

        if (line.match(/^DIE: */)) {
          /* Remote telling us they are dying */
          debugging('lifecycle') && console.debug('Worker is dying (', line + ')');
          shutdown();
          clearTimeout(dieTimer)
          break
        }

        if (line.match(/^LOG: */)) {
          debugging('log') && console.log('Worker', this.serial, 'Log:', line.slice(4));
          continue
        }

        if (!line.match(/^MSG: */)) {
          debugging('messages') && console.debug('worker:', line);
          continue
        }

        lineObj = this.deserialize(line.slice(4))
        switch (lineObj.type) {
          case 'workerMessage': /* Remote posted message */
            ee.emit('message', {data: lineObj.message})
            break
          case 'nop':
            break
          case 'result':
            if (lineObj.hasOwnProperty('exception')) { /* Remote threw exception */
              let e2 = new Error(lineObj.exception.message)
              e2.stack = 'Worker #' + this.serial + ' ' + lineObj.exception.stack + '\n   via' + e2.stack.split('\n').slice(1).join('\n').slice(6)
              e2.name = 'Worker' + lineObj.exception.name
              if (lineObj.exception.fileName) { e2.fileName = lineObj.exception.fileName }
              if (lineObj.exception.lineNumber) { e2.lineNumber = lineObj.exception.lineNumber }
              ee.emit('error', e2)
              continue
            } else {
              if (lineObj.success && lineObj.origin === 'newSerializer') { /* Remote acknowledges change of serialization */
                this.deserialize = this.newSerializer.deserialize
                delete this.newSerializer
              } else {
                debugging() && console.log('Worker', this.serial, 'returned result object: ', lineObj.result);
              }
            }
            break
          default:
            ee.emit('error', new Error('Unrecognized message type from worker #' + this.serial + ', \'' + lineObj.type + '\''))
        }
      } catch (e) {
        console.error('Error processing remote response: \'' + line + '\' (' + e.name + ': ' + e.message + e.stack.split('\n')[1].replace(/^  */, ' ') + ')')
        throw e
      }
    }
  }.bind(this))

  ee.on('error', function standaloneWorker$$Worker$recvData$error (e) {
    console.error("Evaluator threw an error:", e);
  })

  ee.on('message', function standaloneWorker$$Worker$recvData$message (ev) {
    debugging() && console.log("Worker relayed a message:", ev);
  });

  /* Shutdown the stream(s) which are connected to the evaluator */
  shutdown = (e) => {
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = true;
    }

    if (!connected)
      return;
    if (e instanceof Error)
      console.error(e);
    debugging('lifecycle') && console.debug('Shutting down evaluator connection ' + this.serial + '');
    readStream.destroy();
    if (readStream !== writeStream)
      writeStream.destroy();
    connected = false;
  }
  
  readStream.on ('error', shutdown);
  readStream.on ('end',   shutdown);
  readStream.on ('close', shutdown);
  if (readStream !== writeStream) {
    writeStream.on('error', shutdown);
    writeStream.on('end',   shutdown);
    writeStream.on('close', shutdown);
  }

  debugging('lifecycle') && console.debug('Connecting to', hostname + ':' + port);

  socket.on('error', function standaloneWorker$$Worker$error (e) {
    if (!connected) {
      // already connected; if we alreday have a timeout set, note the error but keep waiting
      if (connectTimer) {
        console.error(` repeated error connecting to worker ${this.serial}`, e);
        return;
      }
      
      console.error(`  Error connecting to worker ${this.serial}`, e);
      startConnecting();
      return;
    }
    
    console.error('Error communicating with worker ' + this.serial + ': ', e)
    socket.destroy()
    connected = false
    throw e
  }.bind(this))

  socket.on('close', function standaloneWorker$$Worker$close () {
    debugging('lifecycle') && console.debug('Closed socket ' + this.serial + '');
    if (connected) {
      debugging('lifecycle') && console.debug('- terminating worker ' + this.serial + '');
      connected = false;
      this.terminate();
      socket.destroy();
    }
  }.bind(this))

  socket.on('end', function standaloneWorker$$Worker$end () {
    debugging('lifecycle') && console.debug('Ended socket; closing ' + this.serial + '');
    connected = false
    this.terminate()
    socket.destroy();
  }.bind(this))

  const startConnecting = () => {
    debugging('lifecycle') && console.debug(`Connecting worker ${this.serial} to ${hostname}:${port}; backoff will be ${(config.config.connectBackoff/1000).toFixed(1)}s`);
    // only bind finishConnect() the first time, or things go badly
    socket.connect(port, hostname);
    
    if (connectTimer)
      return;
    
    connectTimer = setTimeout(() => {
      connectTimer = false;
      debugging('lifecycle') && console.error(`! Connect timeout of ${(config.connectBackoff/1000).toFixed(1)}s expired for worker ${this.serial}.`);
      config.connectBackoff = Math.min(config.backoffMax, config.connectBackoff * config.backoffFactor);
      
      startConnecting();
    }, config.connectBackoff);
  };
  
  /** Send a message over the network to a standalone worker */
  this.postMessage = function standaloneWorker$$Worker$postMessage (message) {
    var wrappedMessage = this.serialize({ type: 'workerMessage', message: message }) + '\n'
    if (connected)
      writeStream.write(wrappedMessage);
    else
      pendingWrites.push(wrappedMessage);
  }

  /** Tell the worker to die.  The worker should respond with a message back of
   *  type DIE:, which in turn eventuallys triggers shutdown. fuck
   */
  this.terminate = function standaloneWorker$$Worker$terminate () {
    var wrappedMessage = this.serialize({ type: 'die' }) + '\n'
    try {
      if (connected)
        writeStream.write(wrappedMessage);
      else
        pendingWrites.push(wrappedMessage);
    } catch (e) {
      // Socket may have already been destroyed
    }

    /* If DIE: response doesn't arrive in a reasonable time -- clean up */
    dieTimer = setTimeout(shutdown, 7000);
  }
}

/* Attach setters for onmessage, onerror, etc on the Worker.prototype
 * which are implemented with this.addEventListener.
 */
const onHandlerTypes = ['message', 'error']
exports.Worker.prototype.onHandlers = {}

for (let i = 0; i < onHandlerTypes.length; i++) {
  let onHandlerType = onHandlerTypes[i]
  Object.defineProperty(exports.Worker.prototype, 'on' + onHandlerType, {
    enumerable: true,
    configurable: false,
    set: function (cb) {
      /* maintain on{eventName} singleton pattern */
      if (this.onHandlers.hasOwnProperty(onHandlerType)) {
        this.removeEventListener(onHandlerType, this.onHandlers[onHandlerType])
      }
      this.addEventListener(onHandlerType, cb)
      this.onHandlers[onHandlerType] = cb
    },
    get: function () {
      return this.onHandlers[onHandlerType]
    }
  })
}
