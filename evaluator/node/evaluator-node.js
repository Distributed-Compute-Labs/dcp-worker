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

const vm = require('vm');
const path = require('path');
const fs = require('fs-ext');
const mmap = require('mmap-io');
let debug = !!process.env.DCP_DEBUG_EVALUATOR;

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

  outputStream.setEncoding('utf-8');
  inputStream.setEncoding('utf-8');

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
    name: 'Evaluator ' + (exports.nextEvaluatorId++),
    origin: 'dcp:://evaluator',
    codeGeneration: { strings: true, wasm: true },
  });

  fd = fs.openSync(bootstrapCodeFilename, 'r');
  fs.flockSync(fd, 'sh');
  bootstrapCode = mmap.map(fs.fstatSync(fd).size, mmap.PROT_READ, mmap.MAP_SHARED, fd, 0, mmap.MADV_SEQUENTIAL).toString('utf8');
  fs.closeSync(fd);

  vm.runInContext(bootstrapCode, this.sandboxGlobal, {
    filename: path.basename(bootstrapCodeFilename),
    lineOffset: 0,
    columnOffset: 0,
    displayErrors: true,
    timeout: 60 * 1000,
    breakOnSigInt: true
  });

  /* Pass any new data on the input stream to the onreadln()
   * handler, which the bootstrap code should have hooked.
   */
  this.readData = this.readData.bind(this);
  inputStream.on('data', this.readData);
}
exports.nextEvaluatorId = 1;

/** Destroy a instance of Evaluator, closing the streams
 *  if input and output were the same (presumably a socket).
 */
exports.Evaluator.prototype.destroy = function Evaluator$destroy() {
  this.streams.input.removeListener('data', this.readData);
  clearTimeout(this.nextTimer);

  process.nextTick(() => {
  if (this.streams.input === this.streams.output) /* single socket, not stdio stream pair */
    this.streams.input.destroy();
    this.streams.output = null;
    if (this.incompleteLine)
      console.warn(`Discarded incomplete line ${this.incompleteLine} from destroyed connection`);
  });
}

/** Blocking call to write a line to stdout
 *  @param    line    The line to write
 */
exports.Evaluator.prototype.writeln = function Evaluator$writeln(line) {
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
  var completeLines = data.split('\n');

  if (this.streams.output === null) {
    console.warn(`Discarding buffer ${data} from destroyed connection`);
    return;
  }
  if (this.incompleteLine)
    completeLines[0] = this.incompleteLine + completeLines[0];
  this.incompleteLine = completeLines.pop();

  while (completeLines.length) {
    line = completeLines.shift();
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
 *  @note:  This function is not invoked if this file is require()d.
 */
function main(argv) {
  if (process.argv.length < 3) {
    console.error("Usage: <bootstrapCode.js> [port [listen address]]");
    process.exit(1);
  }

  const bootstrapCodeFilename = process.argv[2];
  if (process.argv.length > 3) {
    const net = require('net');
    let port = +process.argv[3];
    let listenAddr = process.argv.length > 4 ? process.argv[4] : '0.0.0.0';
    let server = net.createServer(handleConnection);

    server.listen({host: listenAddr, port: port}, () => {
      console.log(`Listening for connections on ${listenAddr}:${port}`);
    });

    function handleConnection(socket) {
      new exports.Evaluator(socket, socket, bootstrapCodeFilename);
    }
  } else {
    if (debug)
      console.error(`Started daemon in stdio mode`);
    new exports.Evaluator(process.stdin, process.stdout, bootstrapCodeFilename);
  }
}

if (module.id === '.')
  main(process.argv);
