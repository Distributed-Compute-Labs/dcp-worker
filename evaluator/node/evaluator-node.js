#! /usr/bin/env node
/**
 *  @file       evaluator-node.js
 *              Simple 'node' evaluator -- equivalent to native evaluators,
 *              except it is NOT SECURE as jobs could access the entirety of
 *              the node library, with the permissions of the user the spawning
 *              the daemon.
 *
 * ***** Suitable for development/debug, NOT for production *****
 *
 *  @author     Wes Garland, wes@kingsds.network
 *  @date       June 2018, April 2020
 */
'use strict';

const requireNative = eval('require');
const process = requireNative('process');
const vm = requireNative('vm');
const path = requireNative('path');
let fs, mmap;
try {
  mmap = requireNative('mmap-io');
  fs = requireNative('fs-ext');
} catch(e) {
  fs = requireNative('fs');
}

let debug = process.env.DCP_DEBUG_EVALUATOR;

if (process.getuid() === 0 || process.geteuid() === 0) {
  console.error('Running this program as root is a very bad idea.');
  process.exit(1);
}

/** @constructor
 *  Instantiate a new Evaluator and initialize event handlers, bootstrap
 *  the sandbox, etc.
 *
 *  @param    inputStream            {object} Stream carrying information from the Supervisor
 *  @param    outputStream           {object} Stream carrying information to the Supervisor
 *  @param    bootstrapCodeFilename  {string} Filename of local JS code to run during
 *                                            constructor, to bootstrap the sandbox environment.
 *
 *  @param returns {object} which is an instance of exports.Evaluator that been fully initialized.
 */
exports.Evaluator = function Evaluator(inputStream, outputStream, bootstrapCodeFilename) {
  var fd, bootstrapCode;

  this.sandboxGlobal = {};
  this.streams = { input: inputStream, output: outputStream };
  this.id = exports.Evaluator.seq = (+exports.Evaluator.seq + 1) || 1;

  outputStream.setEncoding('utf-8');
  inputStream.setEncoding('utf-8');

  outputStream.write('running evaluator-node XXX\n');

  /* Add non-standard JavaScript global properties */
  this.sandboxGlobal.self      = this.sandboxGlobal;
  this.sandboxGlobal.die       = ()        => { this.destroy(); };
  this.sandboxGlobal.writeln   = (string)  => { this.writeln(string) };
  this.sandboxGlobal.onreadln  = (handler) => { this.onreadlnHandler = handler };
  this.sandboxGlobal.ontimer   = (handler) => { this.ontimerHandler  = handler };
  this.sandboxGlobal.nextTimer = (when) => {
    if (this.ontimerHandler && (this.nextTimer >= Date.now())) {
      try {
        this.ontimerHandler();
      } catch(e) {
        console.log(e);
      }
    }
    clearTimeout(this.nextTimer);
    this.nextTimer = setTimeout(this.ontimerHandler, when - Date.now()) 
  };

  /* Create a new JS context that has our non-JS-standard global
   * props, and initialize it with the bootstrap code.
   */
  vm.createContext(this.sandboxGlobal, {
    name: 'Evaluator ' + this.id,
    origin: 'dcp:://evaluator',
    codeGeneration: { strings: true, wasm: true },
  });

  fd = fs.openSync(bootstrapCodeFilename, 'r');
  if (mmap) {
    fs.flockSync(fd, 'sh');
    bootstrapCode = mmap.map(fs.fstatSync(fd).size, mmap.PROT_READ, mmap.MAP_SHARED, fd, 0, mmap.MADV_SEQUENTIAL).toString('utf8');
  } else {
    bootstrapCode = fs.readFileSync(fd, 'utf-8');
  }
  fs.closeSync(fd);

  vm.runInContext(bootstrapCode, this.sandboxGlobal, {
    filename: path.basename(bootstrapCodeFilename),
    lineOffset: 0,
    columnOffset: 0,
    contextName: 'Evaluator #' + this.id,
    contextCodeGeneration: {
      wasm: true,
      strings: true
    },
    displayErrors: true,
    timeout: 3600 * 1000,   /* gives us our own event loop; this is max time for one pass run-to-completion */
    breakOnSigInt: true     /* also gives us our own event loop */
  });

  /* Pass any new data on the input stream to the onreadln()
   * handler, which the bootstrap code should have hooked.
   */
  this.readData = this.readData.bind(this);
  inputStream.on('data', this.readData);

  this.destroy = this.destroy.bind(this);
  inputStream.on('end',   this.destroy);
  inputStream.on('close', this.destroy);
  inputStream.on('error', this.destroy);
  if (inputStream !== outputStream) {
    outputStream.on('end',   this.destroy);
    outputStream.on('close', this.destroy);
    outputStream.on('error', this.destroy);
  } 
}

exports.Evaluator.prototype.shutdownSockets = function Evaluator$shutdownSockets() {
  if (this.streams.input !== this.streams.output) /* two streams => stdio, leave alone */
    return;

  debug && console.log(`Evalr-${this.id}: Shutting down evaluator sockets`);
  
  if (this.incompleteLine)
    console.warn(`Discarded incomplete line ${this.incompleteLine} from destroyed connection`);

  this.streams.input .off('end',   this.destroy);
  this.streams.input .off('close', this.destroy);
  this.streams.input .off('error', this.destroy);
  this.streams.output.off('end',   this.destroy);
  this.streams.output.off('close', this.destroy);
  this.streams.output.off('error', this.destroy);

  this.streams.input.destroy();
  this.streams.output.destroy();
  this.streams.output = null;
}
    
/** Destroy a instance of Evaluator, closing the streams input and output 
 *  were the same (presumably a socket). All events are released to avoid
 *  entrain garbage, closures, etc.
 *
 *  Note that this might still not stop the compute dead in its tracks when
 *  we are operating in daemon mode; there is no way to halt a context.
 */
exports.Evaluator.prototype.destroy = function Evaluator$destroy() {
  debug && console.log('Destroying evaluator');
  this.streams.input.removeListener('data', this.readData);
  clearTimeout(this.nextTimer);
  this.sandboxGlobal.writeln = () => { throw new Error('Evaluator ' + this.id + ' has been destroyed; cannot write'); }
  this.sandboxGlobal.progress = () => { throw new Error('Evaluator ' + this.id + ' has been destroyed; cannot send process updates'); }

  this.shutdownSockets();
}

/** Blocking call to write a line to stdout
 *  @param    line    The line to write
 */
exports.Evaluator.prototype.writeln = function Evaluator$writeln(line) {
  if (debug === 'verbose') {
    let logLine = line;
    if (logLine.length > 103)
      logLine = line.slice(0,50) + '...' + line.slice(-50);
    console.log(`Evalr-${this.id}<`, logLine, `${line.length} bytes`);
  }

  if (this.streams.output !== null)
    this.streams.output.write(line + '\n');
  else
    console.error(`Cannot write to destroyed output stream (${line})`);
}

/** Event handler to read data from the input stream. Maintains an internal
 *  buffer of unprocessed input; invokes this.onreadlnHandler as we recognize
 *  lines (terminated by 0x0a newlines).
 */
exports.Evaluator.prototype.readData = function Evaluator$readData(data) {
  var completeLines;

  if (this.streams.output === null) {
    console.warn(`Discarding buffer ${data} from destroyed connection`);
    return;
  }

  if (data.length === 0)
    return;
  completeLines = data.split('\n');
  if (this.incompleteLine)
    completeLines[0] = this.incompleteLine + completeLines[0];
  this.incompleteLine = completeLines.pop();

  (debug === 'verbose') && console.log(`Evalr-${this.id} read ${completeLines.length} complete lines, plus ${this.incompleteLine.length} bytes of next`);

  while (completeLines.length) {
    let line = completeLines.shift();

    if (debug === 'verbose') {
      let logLine = line;
      if (logLine.length > 103)
        logLine = line.slice(0,50) + '...' + line.slice(-50);
      console.log(`Evalr-${this.id}>`, logLine, `${line.length} bytes`);
    }

    if (this.onreadlnHandler) {
      try {
        this.onreadlnHandler(line + '\n');
      } catch(e) {
        console.log(e);
      }
    }
   else
     console.warn(`Warning: no onreadln handler registered; dropping line '${line}'`);
  }
}

/** Main program entry point; either establishes a daemon that listens for tcp
 *  connections, or falls back to inetd single sandbox mode.
 *
 *  @note:  This function is not invoked if this file is requireNative()d; only when
 *          it is used as a program module.
 */
function main(argv) {
  if (process.argv.length < 3) {
    console.error("Usage: <bootstrapCode.js> [port [listen address]]");
    process.exit(1);
  }

  const bootstrapCodeFilename = process.argv[2];
  if (process.argv.length > 3) {
    const net = requireNative('net');
    let port = +process.argv[3];
    let listenAddr = process.argv.length > 4 ? process.argv[4] : '127.0.0.1';
    let server = net.createServer(handleConnection);

    server.listen({host: listenAddr, port: port}, () => {
      console.log(`Listening for connections on ${listenAddr}:${port}`);
    });

    function handleConnection(socket) {
      debug && console.log('Handling new connection from supervsior');
      new exports.Evaluator(socket, socket, bootstrapCodeFilename);
    }
  } else {
    debug && console.error(`Started daemon in stdio mode - disabling debug mode`);
    debug = false;
    new exports.Evaluator(process.stdin, process.stdout, bootstrapCodeFilename);
  }
}

if (module.id === '.')
  main(process.argv);
