#! /usr/bin/env node

/** Simple 'node' miner -- equivalent to v8, spidermonkey, etc, miners
 *  except it is NOT SECURE as jobs have access to the entirety of the
 *  node library, with the permissions of the user the spawning the
 *  daemon.
 *
 *  Suitable for development, NOT for produciton
 *
 *  Note: not best practices for network code in JavaScript. Sync code
 *        more suited to C / C++ environments.
 */
const fs = require("fs")
process.stdin.setEncoding("ascii")
process.stdout.setEncoding("ascii")

const config = {
  minerControlFilename: "../unix/dcp-miner-control.js"
}

try {
  require("sleep").sleep(0)
} catch (e) {
  throw new Error("Please npm install sleep")
}

/** Blocking call to read a single line from stdin (the standaloneWorker) 
 *  @returns a string terminated by a linefeed character
 */
function readln() {
  var buf = new Buffer(10240)
  var nRead

  if (!readln.pendingData)
    readln.pendingData = ""

  while (true) {
    if (readln.pendingData.length) {
      let i=readln.pendingData.indexOf('\n')
      if (i !== -1) {
	let line = readln.pendingData.slice(0,i + 1)
	readln.pendingData = readln.pendingData.slice(i + 1)
	return line
      }
    }

    try {
      nRead = fs.readSync(process.stdin.fd, buf, 0, buf.length)
    } catch (e) {
      switch(e.code) {
	case 'EAGAIN':
  	  nRead = 0
	  break
	case 'EOF':
  	  nRead = -1
	  break
        default:
  	  throw e
      }
    }

    if (nRead < 0)
      return null // socket is closed
    if (nRead == 0) { // nothing to read - give up timeslice
      require("sleep").sleep(0)
      continue
    }

    readln.pendingData += bufToStr(buf, nRead)
  }
}

function bufToStr(buf, nRead) {
  var s = ''

  for (let i=0; i < nRead; i++) {
    s += String.fromCharCode(buf[i])
  }

  return s
}

/** Blocking call to write a line to stdout (the standaloneWorker) 
 *  @param    line    The line to write
 */
function writeln(line) {
  process.stdout.write(line + "\n")
}

/* Run the control code - this is what talks to standaloneWorker.Worker */
var code = fs.readFileSync(require.resolve(config.minerControlFilename), "ascii")
global.writeln = writeln
global.readln = readln

if (false) {
  let indirectEval = eval
  global.this = global
  global.self = global
  indirectEval(code)
} else {
  let Script = require('vm').Script
  let minerControl = new Script(code, {filename: config.minerControlFilename, lineOffset:0, columnOffset:0})
  global.indirectEval = function(code, filename) {
    if (!filename) {
      /* Pull filename from code comments if not specified */
      if (filename = code.match(/^ *\* *@file.*$/mi)[0]) {
	filename = "guess::" + filename.replace(/.*@file */i,'').replace(/ .*$/,'')
      }
    }
    (new Script(code, {filename: filename || "dcp-miner-node::indirectEval", lineOffset:0, columnOffset:0})).runInThisContext()
  }
  minerControl.runInThisContext()
}
