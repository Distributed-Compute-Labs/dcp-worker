#! /usr/bin/env node
/**
 *  @file       inet-daemon.js          Simple daemon for node that works like xinetd/inetd
 *
 *                                      Configuration is read from the DCP config.js module.
 *                                      Services are configured thus:
 *
 *                                       inetDaemon: {
 *                                         label: {
 *                                           net:       {
 *                                             port: port,
 *                                             listenHost: optional,
 *                                           }
 *                                           process:   /path/to/binary
 *                                           arguments: [ argv1, argv2, ... ]
 *                                         },
 *                                         label2: { .... }
 *                                       }
 *
 *  @author     Wes Garland, wes@kingsds.network
 *  @date       June 2018
 */
/* global dcpConfig */
const net = require('net')
var debug = process.env.DEBUG || ''
// console.log(process.env)
require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

Object.entries(dcpConfig.inetDaemon).forEach(function (param) {
  var [name, config] = param
  var server = net.createServer(handleConnection)

  if (debug.indexOf('verbose') !== -1) {
    console.log('Listening for ' + name + ' connections on ' + (config.net.listenHost || 'inaddr_any') + ':' + config.net.port)
  }
  server.listen({port: config.net.port, host: config.net.listenHost}, () => {
    // To let tests know we've actually started
    if (process.env.FORKED) {
      process.send({
        request: 'Server Started',
        config
      })
    }
  })

  function handleConnection (socket) {
    if (debug.indexOf('verbose') !== -1) { console.log('New connection; spawning ', config.process, config.arguments) }
    var child = require('child_process').spawn(config.process, config.arguments || [])
    if (debug) { console.log('Spawned a new worker process, PID:', child.pid) }

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
        console.log('W> ', bufToDisplayStr(data).slice(0, 64), '...')
      }
      try {
        child.stdin.write(data)
      } catch (e) {
        console.log('could not write to worker process (', child.pid, ') stdin')
        throw e
      }
    })

    if (debug) { console.log('Handling new connection') }
  }
})

function bufToDisplayStr (buf) {
  return Buffer.from(buf.toString('utf-8').replace(/\n/, '\u2424')).toString('utf-8')
}

process.on('uncaughtException', function (e) {
  console.log('\n---', (new Date()).toLocaleString(), '-------------------------------------------------')
  console.log('uncaught exception:', e.stack)
  console.log('\n')
})
