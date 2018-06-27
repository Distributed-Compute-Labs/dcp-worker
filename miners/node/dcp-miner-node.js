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
const fs = require("fs");
process.stdin.setEncoding("ascii");
process.stdout.setEncoding("ascii");

/** Blocking call to read a single line from stdin (the standaloneWorker) */
function readln() {
  var buf = new Buffer(1024);
  var nRead;

  if (!readln.pendingData)
    readln.pendingData = ""

  while (true) {
    if (readln.pendingData.length) {
      let i=readln.pendingData.indexOf('\n')
      if (i !== -1) {
	let line = readln.pendingData.slice(0,i + 1)
	readln.pendingData = readln.pendingData.slice(i + 1)
	return line;
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
      return null; // socket is closed
    if (nRead == 0) { // nothing to read - give up timeslice
      require("sleep").sleep(0);
      continue;
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

/** Blocking call to write a line to stdout (the standaloneWorker) */
function writeln(line) {
  process.stdout.write(line + "\n")
}

/** Load the control code - this is what talks to standaloneWorker.Worker */
eval(fs.readFileSync(require.resolve("../unix/dcp-miner-control.js"), "ascii"))
