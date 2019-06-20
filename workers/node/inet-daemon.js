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
 *                                             host: optional,
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
var counter = 0

// console.log(process.env)
require('dcp-rtlink/rtLink').link(module.paths)
require('config').load()

console.log('DCP inetd starting...')

if (debug) {
  console.log('** Debug mode:', debug)
  if (debug.includes('verbose')) {
    console.log('Config:', dcpConfig.inetDaemon)
  }
}

Object.entries(dcpConfig.inetDaemon).forEach(function (param) {
  var [name, config] = param
  var server = net.createServer(handleConnection)

  server.listen({host: config.net.location.hostaddr, port: config.net.location.port}, () => {
    console.log('Listening for ' + name + ' connections on ' + (config.net.listen.hostaddr || 'inaddr_any') + ':' + config.net.listen.port)
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
    child.index = counter++

    if (debug) { console.log('Spawned a new worker process, PID:', child.pid, 'Index:', child.index) }

    child.stderr.setEncoding('ascii')

    socket.on('end', function () {
      if (debug) { console.log('Killing worker', child.index) }
      child.kill()
    })

    socket.on('error', function (e) {
      console.log('Error from supervisor for worker ' + child.index + ':', e)
      socket.destroy()
      child.kill()
    })

    child.on('error', function (e) {
      console.log('Error from worker ' + child.index + ':', e)
      socket.destroy()
      child.kill()
    })

    child.on('exit', function (code) {
      if (debug) { console.log('worker exited; closing socket', code || '', 'index:', child.index) }
      socket.end()
      socket.destroy()
    })

    child.stdout.on('data', function (data) {
      if (debug.indexOf('network') !== -1) {
        console.log('<W', child.index, bufToDisplayStr(data))
        if (data.length > 100) {
          console.log('\n')
        }
      }
      socket.write(data)
    })

    child.stderr.on('data', function (data) {
      console.log('worker ' + child.index + ' stderr: ', data)
    })

    socket.on('data', function (data) {
      if (debug.indexOf('network') !== -1) {
        console.log('W>', child.index, bufToDisplayStr(data, 93))
      }
      try {
        child.stdin.write(data)
      } catch (e) {
        console.warn('could not write to worker process (', child.pid, ', index', child.index, ') stdin')
        throw e
      }
    })
  }
})

function bufToDisplayStr (buf, limit) {
  const str = Buffer.from(buf.toString('utf-8').replace(/\n/, '\u2424')).toString('utf-8')

  if (typeof limit === 'number' && str.length > limit) {
    return str.substr(0, limit) + '...'
  } else {
    return str
  }
}

process.on('uncaughtException', function (e) {
  console.log('\n---', (new Date()).toLocaleString(), '-------------------------------------------------')
  console.log('uncaught exception:', e.stack)
  console.log('\n')
})
