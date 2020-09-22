#! /usr/bin/env node
/**
 *  @file       evaluator-node.js
 *              Simple 'node' evaluator -- equivalent to native evaluators,
 *              except it is NOT SECURE as jobs could access the entirety of
 *              the node library, with the permissions of the user the spawning
 *              the process.
 *
 * ***** Suitable for development/debug, NOT for production *****
 *
 *  @author     Wes Garland, wes@kingsds.network
 *  @date       June 2018, April 2020
 */
'use strict';

const process = require('process');
const vm = require('vm');
const path = require('path');
let fs, mmap;
try {
  mmap = require('mmap-io');
  fs = require('fs-ext');
} catch(e) {
  fs = require('fs');
}

let debug = process.env.DCP_DEBUG_EVALUATOR;

if (
  /**
   * Checkwhether this script is being run in CI; if not, check whether it is a POSIX
   * environment; if so, check whether running as root and bail if so.
   */
  process.env.CI_ENV !== "gitlab" &&
  (process.getuid && (process.getuid() === 0 || process.geteuid() === 0))
) {
  console.error(
    "Running this program as root is a very bad idea. Exiting process..."
  );
  process.exit(1);
}

/** @constructor
 *  Instantiate a new Evaluator and initialize event handlers, bootstrap
 *  the sandbox, etc.
 *
 *  @param    inputStream            {object} Stream carrying information from the Supervisor
 *  @param    outputStream           {object} Stream carrying information to the Supervisor
 *  @param    files  {string} Filenames of local JS code to run during
 *                                            constructor, to bootstrap the sandbox environment.
 *
 *  @param returns {object} which is an instance of exports.Evaluator that been fully initialized.
 */
exports.Evaluator = function Evaluator(inputStream, outputStream, files) {
  var fd, bootstrapCode;

  this.sandboxGlobal = {};
  this.streams = { input: inputStream, output: outputStream };
  this.id = exports.Evaluator.seq = (+exports.Evaluator.seq + 1) || 1;

  outputStream.setEncoding('utf-8');
  inputStream.setEncoding('utf-8');

  /* Add properties to sandbox global scope */
  Object.assign(this.sandboxGlobal, {
    self: this.sandboxGlobal,
    die: () => { this.destroy(); },
    writeln: (string)  => { this.writeln(string) },
    onreadln: (handler) => { this.onreadlnHandler = handler },
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
  });

  /* Create a new JS context that has our non-JS-standard global
   * props, and initialize it with the bootstrap code.
   */
  vm.createContext(this.sandboxGlobal, {
    name: 'Evaluator ' + this.id,
    origin: 'dcp:://evaluator',
    codeGeneration: { strings: true, wasm: true },
  });

  for(const file of files) {
    fd = fs.openSync(file, 'r');
    if (mmap) {
      fs.flockSync(fd, 'sh');
      bootstrapCode = mmap.map(fs.fstatSync(fd).size, mmap.PROT_READ, mmap.MAP_SHARED, fd, 0, mmap.MADV_SEQUENTIAL).toString('utf8');
    } else {
      bootstrapCode = fs.readFileSync(fd, 'utf-8');
    }
    fs.closeSync(fd);

    vm.runInContext(bootstrapCode, this.sandboxGlobal, {
      filename: path.basename(file),
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
  }

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
 *  we are operating in solo mode; there is no way to halt a context.
 */
exports.Evaluator.prototype.destroy = function Evaluator$destroy() {
  debug && console.log('Destroying evaluator');
  this.streams.input.removeListener('data', this.readData);
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

/** Launch a solo evaluator listener - listen on a port, run the evaluator in this
 *  process until completion. Primarily useful for running in a debugger.
 *
 *  @param   listenAddr   {string}    The address of the interface to listen on
 *  @param   port         {number}    The TCP port number to listen on
 *  @param   files        {string}   The files to run in each new Evaluator
 */
function solo(listenAddr, port, files) {
  const net = require('net');
  let server = net.createServer(handleConnection);

  server.listen({host: listenAddr, port: port}, () => {
    console.log(`Listening for connection on ${listenAddr}:${port} [solo mode]`);
  });

  function handleConnection(socket) {
    debug && console.log('Handling new connection from supervsior');
    new exports.Evaluator(socket, socket, files);
  }
}

/** Launch an a full evaluator server - listen on a port and run an evaluator in a
 *  new process for each incoming connection.
 *
 *  @param   listenAddr   {string}    The address of the interface to listen on
 *  @param   port         {number}    The TCP port number to listen on
 *  @param   files        {string}   The files to run in each new Evaluator
 */
function server(listenAddr, port, files) {
  const net = require('net');
  let server = net.createServer(handleConnection);

  server.listen({host: listenAddr, port: port}, () => {
    console.log(`Listening for connections on ${listenAddr}:${port}`);
  });

  function handleConnection(socket) {
    const child_process = require('child_process');
    var child;

    debug && console.log('Spawning child to handle new connection from supervsior');

    child = child_process.spawn(process.execPath, [ __filename, ...files ]);
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk) => process.stderr.write('child>', chunk));
    child.stdout.on('data', (chunk) => socket.write(chunk));
    socket.on('data', (chunk) => child.stdin.write(chunk));
    socket.on('close', () => child.kill('SIGINT'));
    socket.on('end', () => {
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      setImmediate(() => child.kill());
    });
  }
}

/** Main program entry point; either establishes a server that listens for tcp
 *  connections, or falls back to inetd single sandbox mode.
 *
 *  @note:  This function is not invoked if this file is require()d; only when
 *          it is used as a program module.
 */
function main() {
  const argv = require('yargs')
  .usage('Node Evaluator - Copyright (c) 2020 Kings Distributed Systems. All Rights Reserved.'
    + 'Usage: dcp-evaluator [options] [<file.js> <file.js> ...]')
  .options({
    port: {
      describe: 'Indicates port number to listen on (default: stdio pipes).',
    },
    listen: {
      describe: 'Indicates address of network interface to listen on (listen address|any).',
      default: false,
    },
    solo: {
      describe: 'Do not fork; only run one evaluator at a time.',
      type: 'boolean',
      default: false,
    },
  })
  .argv;
  const files = argv._;

  if(argv.port) {
    let listen = argv.listen;
    if(listen === 'any' || listen === 'any/0') {
      listen = '0.0.0.0';
    }

    if(argv.solo) {
      solo(argv.listen, argv.port, files);
    } else {
      server(argv.listen, argv.port, files);
    }
  } else {
    debug && console.error(`Started in stdio mode - disabling debug mode`);
    debug = false;
    new exports.Evaluator(process.stdin, process.stdout, files);
  }
}

if (module.id === '.')
  main();
