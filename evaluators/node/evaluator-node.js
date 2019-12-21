#! /usr/bin/env node
/** 
 *  @file       evaluator-node.js
 *              Simple 'node' evaluator -- equivalent to native evaluators,
 *              except it is NOT SECURE as jobs have access to the entirety of
 *              the node library, with the permissions of the user the spawning
 *              the daemon.
 *
 * ***** Suitable for development, NOT for production *****
 *
 *  Note: not best practices for network code in JavaScript. Sync code
 *        more suited to C / C++ environments.
 *
 *  @author     Wes Garland, wes@kingsds.network
 *  @date       June 2018
 */

const fs = require('fs')
const path = require('path')
const process = require('process')
process.stdin.setEncoding("utf-8")

const config = {
  environmentPath: path.resolve(path.dirname(process.argv[1]))
}

try { require("sleep").sleep(0) } catch (e) { throw new Error("Please npm install sleep") }

/** Blocking call to read a single line from stdin
 *  @returns a string terminated by a linefeed character
 */
function readln() {
  var buf = new Buffer(10240)
  var nRead
  var backoffCount = 0

  if (!readln.pendingData)
    readln.pendingData = ""

  while (true) {
    if (readln.pendingData.length) {
      let i=readln.pendingData.indexOf('\n')
      if (i !== -1) {
        let line = readln.pendingData.slice(0, i + 1)
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
      require("sleep").usleep(Math.round(1000 * Math.min(Math.max(Math.log(3*backoffCount) + (backoffCount/2),0),50)))
      backoffCount++
      continue
    }

    backoffCount = 0
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

/** Blocking call to write a line to stdout
 *  @param    line    The line to write
 */
function writeln(line) {
  process.stdout.write(line + '\n', 'utf-8')
}

/* Run the control code */
var code = fs.readFileSync(require.resolve(config.environmentPath), "ascii")
global.writeln = writeln
global.readln = readln
global.this = global
global.self = global

if (false) {
  let indirectEval = eval
  indirectEval(code)
} else {
  let Script = require('vm').Script
  let environment = new Script(code, {filename: config.environmentPath, lineOffset: 0, columnOffset: 0})

  global.indirectEval = function(code, filename) {
    if (!filename) {
      /* Pull filename from code comments if not specified */
      if (filename = code.match(/^ *\* *@file.*$/mi)[0]) {
        filename = "guess::" + filename.replace(/.*@file */i,'').replace(/ .*$/,'')
      }
    }
    (new Script(code, {filename: filename || "evaluator-node::indirectEval", lineOffset:0, columnOffset:0})).runInThisContext()
  }
  environment.runInThisContext()
}
