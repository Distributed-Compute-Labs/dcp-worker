#! /usr/bin/env node

/** Simple daemon for node that works like xinetd/inetd from the worker's POV */

var debug = process.env.DEBUG || ''
var config = {
  listenPort: process.env.NSAM_LISTEN_PORT || '9000',
  listenHost: process.env.NSAM_LISTEN_HOST || '127.0.0.1',
  processName: process.env.NSAM_PROCESS_NAME || 'node',
  processArgs: process.env.NSAM_PROCESS_ARGS ? process.env.NSAM_PROCESS_ARGS.split(' ') : [require.resolve('./dcp-miner-node.js')]
}

const net = require('net')
var server = net.createServer(handleConnection)

server.listen(config.listenPort, config.listenHost)

function handleConnection (socket) {
  var child = require('child_process').spawn(config.processName, config.processArgs)
  child.stderr.setEncoding('ascii')

  socket.on('end', function () {
    if (debug) { console.log('Killing worker') }
    child.kill()
  })

  socket.on('error', function (e) {
    console.log('Error from supervisor:', e)
    socket.destroy()
    child.kill()
  })

  child.on('error', function (e) {
    console.log('Error from worker:', e)
    socket.destroy()
    child.kill()
  })

  child.on('exit', function (code) {
    if (debug) { console.log('worker exited; closing socket', code || '') }
    socket.end()
    socket.destroy()
  })

  child.stdout.on('data', function (data) {
    if (debug.indexOf('network') !== -1) {
      console.log('<W ', bufToDisplayStr(data))
      if (data.length > 100) {
        console.log('\n')
      }
    }
    socket.write(data)
  })

  child.stderr.on('data', function (data) {
    console.log('worker stderr: ', data)
  })

  socket.on('data', function (data) {
    if (debug.indexOf('network') !== -1) {
      console.log('W> ', bufToDisplayStr(data))
      if (data.length > 100) {
        console.log('\n')
      }
    }
    child.stdin.write(data)
  })

  if (debug) { console.log('Handling new connection') }
}

function bufToDisplayStr (buf) {
  return Buffer.from(buf.toString('utf-8').replace(/\n/, '\u2424')).toString('utf-8')
}

process.on('uncaughtException', function (e) {
  console.log('\n---', (new Date()).toLocaleString(), '-------------------------------------------------')
  console.log('uncaught exception:', e.stack)
  console.log('\n')
})
