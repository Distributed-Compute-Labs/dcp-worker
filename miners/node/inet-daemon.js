#! /usr/bin/env node

/** Simple daemon for node that works like xinetd/inetd from the worker's POV */

var debug = false
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
  child.stdin.setEncoding("ascii");
  child.stderr.setEncoding("ascii");
  socket.setEncoding("ascii");

  socket.on("end", function() {
    if (debug)
      console.log("Killing miner")
    child.kill()
  })

  socket.on("error", function(e) {
    socket.destroy()
    child.end()
  })

  child.on("exit", function(code) {
    if (debug)
      console.log("Miner exited")
    socket.destroy();
  })

  child.stdout.on("data", function(data) {
    socket.write(data)
  })

  child.stderr.on("data", function(data) {
    console.log("stderr: ", data)
  })

  socket.on("data", function(data) {
    child.stdin.write(data)
  })
}
