/**
 *  @file       standaloneWorker.js     A Node module which implements the class standaloneWorker,
 *                                      which knows how to execute jobs over the network in a
 *                                      standalone worker.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       March 2018
 */

module.paths.push("/var/dcp/lib")
module.paths.push("/var/dcp/www/docs/node_modules")

/** Module configuration parameters. May be altered at runtime. Should be altered
 *  before first Worker is instanciated.
 */
exports.config = {
  debug: process.env.DCP_SAW_DEBUG || false, /* When false, console.debug is NOP */
  debugLevel: parseInt(process.env.DCP_SAW_DEBUG,10), /* Bigger = more verbose */
  defaultHostname: '127.0.0.1',
  defaultService: '9000',
  docRoot: '/var/dcp/www/docs'
}

console.debug = function () {
  if (!exports.config.debug) {
    return
  }

  console.log.apply(null, arguments)
}

if (!exports.config.debug) {
  console.debug = function () {}
}

/** Worker constructor
 *  @param      filename        The filename of the code to run in the worker, relative to exports.config.docRoot.
 *  @param      hostname        The hostname (or IP number) of the standalone miner process.
 *  @param      service         The service (or port number) of the standalone miner process.
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
 *    . messeage
 */
exports.Worker = function standaloneWorker$$Worker (filename, hostname, service) {
  var socket = new (require('net')).Socket()
  var ee = new (require('events').EventEmitter)()
  var pendingWrites = []
  var readBuf = ''
  var connected = false
  var dieTimer
  var code
  
  if (typeof filename !== 'string') { throw new TypeError('filename must be a string!') }
  if (filename[0] === '.') { throw new Error('relative paths not allowed (security)') }
  code = require('fs').readFileSync(exports.config.docRoot + '/' + (filename.replace(/\?.*$/, '')), 'utf-8')

  this.addEventListener = ee.addListener.bind(ee)
  this.removeEventListener = ee.removeListener.bind(ee)
  this.serial = exports.Worker.lastSerial = (exports.Worker.lastSerial || 0) + 1
  this.serialize = JSON.stringify
  this.deserialize = JSON.parse

  function finishConnect () {
    let wrappedMessage = this.serialize({ type: 'initWorker', w: this.serial, ts: Date.now(), payload: code, origin:filename.replace(/\?.*$/, '') }) + '\n'
    connected = true
    socket.setEncoding('utf-8')
    console.debug('Connected ' + pendingWrites.length + ' pending messages.')

    /* We buffer writes in pendingWrites between the call to connect() and
     * the actual establishment of the TCP socket. Once connected, we drain that
     * buffer into the write buffer in Node's net module.  We still, however,
     * emit the initialization code first; the other writes will be postMessage etc
     */
    socket.write(wrappedMessage)
    while (pendingWrites.length && !socket.destroyed) {
      socket.write(pendingWrites.shift())
    }
    
    changeSerializer.bind(this)("/var/dcp/lib/serialize.js")
  }

  function changeSerializer(filename) {
    let code = require("fs").readFileSync("/var/dcp/lib/serialize.js", "utf-8")

    if (this.newSerializer) { throw new Error("Outstanding serialization change on worker #" + this.serial )}

    this.newSerializer = eval(code)
    socket.write(this.serialize({ type: "newSerializer", payload: code }) + "\n")
    this.serialize = this.newSerializer.serialize  /* do not change deserializer until worker acknowledges change */
  }

  /* Receive data from the network, turning it into debug output,
   * remote exceptions, worker messages, etc.
   */
  socket.on('data', function standaloneWorker$$Worker$recvData (data) {
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
          if (exports.config.debugLevel > 2) { console.debug('Worker is dying (', line + ')') }
          socket.destroy()
          clearTimeout(dieTimer)
          break
        }

        if (line.match(/^LOG: */)) {
	  console.log("Worker", this.serial, "Log:", line.slice(4))
	  continue
	}

        if (!line.match(/^MSG: */)) {
          if (exports.config.debugLevel > 2) { console.debug('worker:', line) }
          continue
        }
 
        lineObj = this.deserialize(line.slice(4))
	switch(lineObj.type) {
	  case "workerMessage": /* Remote posted message */
            ee.emit('message', {data: lineObj.message})
	    break
          case "result":
            if (lineObj.hasOwnProperty('exception')) { /* Remote threw exception */
	      let e2 = new Error(lineObj.exception.message);
	      e2.stack = "Worker #" + this.serial + " " + lineObj.exception.stack + "\n   via" + e2.stack.split('\n').slice(1).join('\n').slice(6)
	      e2.name = "Worker" + lineObj.exception.name
	      if (lineObj.exception.fileName) { e2.fileName = lineObj.exception.fileName }
	      if (lineObj.exception.lineNumber) { e2.lineNumber = lineObj.exception.lineNumber }
	      ee.emit('error', e2)
	      continue
            } else {
	      if (lineObj.success && lineObj.origin === "newSerializer") { /* Remote acknowledges change of serialization */
		this.deserialize = this.newSerializer.deserialize
		delete this.newSerializer
	      } else {
		if (config.debug) { 
		  console.log("Worker", this.serial, "returned result object: ", result) 
		}
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

  socket.on('error', function worker$$Error (e) {
    console.error('Error communicating with worker: ', e)
    socket.destroy()
    throw e
  })

  socket.on('close', function worker$$Close () {
    console.debug('Closed socket')
  })

  console.debug('Connecting to', (hostname || exports.config.defaultHostname) + ':' + (service || exports.config.defaultService))
  socket.connect(service || exports.config.defaultService, hostname || exports.config.defaultHostname, finishConnect.bind(this))

  /** Send a message over the network to a standalone worker */
  this.postMessage = function standaloneWorker$$Worker$postMessage (message) {
    var wrappedMessage = this.serialize({ type: 'workerMessage', message: message }) + '\n'
    if (connected) { socket.write(wrappedMessage) } else { pendingWrites.push(wrappedMessage) }
  }

  /** The the worker to die.  The worker should respond with a message back of
   *  type DIE:, which in turn eventuallys triggers socket.close() and .destroy()
   */
  this.terminate = function Worker$$terminate () {
    var wrappedMessage = this.serialize({ type: 'die' }) + '\n'
    if (connected) { socket.write(wrappedMessage) } else { pendingWrites.push(wrappedMessage) }

    /* If DIE: response doesn't arrive in a reasonable time -- clean up */
    function cleanup () {
      socket.destroy()
    }
    dieTimer = setTimeout(cleanup, 7000)
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
      if (this.onHandlers.hasOwnProperty(onHandlerType)) { this.removeEventListener(onHandlerType, this.onHandlers[onHandlerType]) }
      this.addEventListener(onHandlerType, cb)
      this.onHandlers[onHandlerType] = cb
    },
    get: function () {
      return this.onHandlers[onHandlerType]
    }
  })
}
