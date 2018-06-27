#! /usr/bin/env node

/** Simple daemon for node that works like xinetd/inetd from the worker's POV */

var debug = process.env.NODE_MINER_DEBUG || ""
var config = {
  listen_port: process.env.NODE_MINER_LISTEN_PORT || '9000',
  listen_host: process.env.NODE_MINER_LISTEN_HOST || '127.0.0.1',
  node_path: 'node'
}

const net = require('net')
var server = net.createServer(handleConnection)

server.listen(config.listen_port, config.listen_host)

function handleConnection(socket) {
  if (debug)
    console.log("Handling new connection")
  child = require("child_process").spawn(config.node_path, [require.resolve("./dcp-miner-node.js")])
  child.stdin.setEncoding("ascii")
  child.stdout.setEncoding("ascii")
  child.stderr.setEncoding("ascii")
  socket.setEncoding("ascii")

  socket.on("end", function() {
    if (debug)
      console.log("Killing worker")
    child.kill()
  })

  socket.on("error", function(e) {
    console.log("Error from supervisor:", e)
    socket.destroy()
    child.end()
  })

  child.on("error", function(e) {
    console.log("Error from worker:", e)
    socket.destroy()
    child.end()
  })

  child.on("exit", function(code) {
    if (debug)
      console.log("worker exited; closing socket", code ? code : "")
    socket.end()
    socket.destroy()
  })

  child.stdout.on("data", function(data) {
    if (debug.indexOf("network") !== -1) {
      console.log("> ", data.replace(/\n/, "\u2424"))
      if (data.length > 100)
	console.log('\n')
    }
    socket.write(data)
  })

  child.stderr.on("data", function(data) {
    console.log("worker stderr: ", data)
  })

  socket.on("data", function(data) {
    if (debug.indexOf("network") !== -1) {
      console.log("< ", data.replace(/\n/, "\u2424"))
      if (data.length > 100)
	console.log('\n')
    }
    child.stdin.write(data)
  })
}

process.on('uncaughtException', function (e) {
  console.log('\n---',(new Date()).toLocaleString(),'-------------------------------------------------')
  console.log('uncaught exception:', e.stack)
  console.log('\n')
})
