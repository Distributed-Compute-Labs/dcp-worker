# Standalone Worker Miner

The Standalone Worker Miner is a program which runs in Node and is mostly a wrapper for compute.js.  It causes the DistributedWorker() class to be invoked using the standaloneWorker.Worker() class instead of
web workers, which allows standalone miners (see ../../workers/sa-unix, ../../workers/sa-windows, and ../../workers/sa-node for examples).

# Standalone Worker Protocol

The Standalone Worker protocol is a simple, line-oriented protocol which exchanges messages between the supervisor and worker "threads" over TCP/IP, analogous to the behind-the-scenes messaging that happens in the browser when using WebWorkers.

Each message is a line of text, terminated with a LF character (0x0a). The message type is determined by the first few characters.  This message format makes it possible to implement the messaging protocol over a Unix pipeline, inetd-style service, etc, and potentially graft in emergency repairs to a running system with sed/awk/grep/etc.

The worker's side of the protocol is implemented in sa-worker-control.js, which runs from sa-worker-v8, sa-worker-node (and, someday, sa-worker-jsapi, etc). sa-worker-v8 is a bare JavaScript environment with only two functions implemented beyond what is the standard: readln() and writeln().  These two functions, implemented in C++, are used to perform I/O over stdin/stdout, and is how the SWP messages are exchanged between supervisor and worker.

The supervisor's side of the protocol is implemented in standaloneWorker.  This module implements an interface, Worker, which is very much like traditional web workers, except that it works over these messages and TCP/IP rather than private browser back-end magic.  The major difference between the two types of workers is that this worker can ONLY exchange data which can be encoded in JSON, which is somewhat more limiting than web workers, as they can exchange any object type which can be encoded by a deep clone. *note* - src/serialize.js has JSON as the final output stage, allowing us to pass TypedArrays, circular objects, etc, over this messaging prototocol if we need to.

## Implementing the protocol
In order to make sa-worker-control and standaloneWorker talk to each other, you need to
1. use standaloneWorker from node.js any place you would use a web worker (e.g. the DistributedWorker constructor in DCPv3)
2. eval sa-worker-control in an environment which has an event loop and the following global symbols:
   - writeln(): write an entire line out to the network.  It doesn't matter if it blocks, as long as packets are sent in order.
   - onreadln(): accepts as its argument a function, which is invoked whenever a complete line of text is received from the network. The line is passed as its sole argument.
   - ontimer(): accepts as its argument a function, which is invoked when told to via nextTimer
   - nextTimer(): accepts as its argument a number, which tells us when to fire the ontimer() argument, in number of milliseconds since the epoch.
   - die(): terminate the event loop
      
## Messages from the Worker to the Supervisor
##### DIE:
This message type is sent in response to a die command, acknowledging the worker's impending doom.

##### LOG:
This message type is used to implement console logging for debug purposes. The remaining contents of the line are logged in the supervisor using the console.debug() facility.

##### MSG:
This message type is sent when the worker is sending us a message which carries with it an object encoded with JSON that becomes an argument to an event emitter in the supervisor.

If the object has a `message` property, that property will become the data.message property of the object passed to the "message" event emitter in the supervisor.  This is used to implement postMessage->onmessage from the worker to the supervisor.

If the object has an `exception` property, the data.exception object will become the argument for the "error" event emitter in the supervisor.  This is used to implement onerror from the worker to the supervisor, allowing us to implement uncaught exception handling.

It is also used when the worker needs to propogate an uncaught exception back to the worker. In this case, the data.exception property of the encoded object

##### Empty Lines
Empty lines are ignored.

##### Unrecognized messages
Messages not matching any of the above are treated as LOG: messages. This is a good way to start implementing additional out-of-band functionality -- simply invent your message type in the worker, test that it sends the correct data to the supervisor, then modify the `standaloneWorker.Worker()` code to recognize the new message type and act on it.

## Messages from the Supervisor to the Worker

Messages from the Supervisor to the Worker are simply JSON objects terminated with linefeed characters (0x0a).  Each object has a `type` property which encodes the type of message it is, and a `message` property containing the actual message.

##### initWorker
This message is used to initialize an "empty" worker.  The payload property is code which is evaluated in the worker.

##### workerMessage
Each message will be emitted in the worker as a "message" event. This is used to implement postMessage->onmessage from the supervisor to the worker.

##### newSerializer
This message is used to change the serialization format between standaloneWorker and sa-worker-control.  The 'payload' argument includes code which evals to an exports object which has serialize and deserialize methods, which are call-compatiable with JSON.stringify and JSON.parse.  Once this message has been sent, all subsequent messages will be sent in the new format.  Messages will continue to be received in the old format, until the receipt of this message has been acknowleged.

##### nop
This message does nothing except verify that the parsing link is working. It can be used as a placeholder during protocol up/downgrade negotiation, keepalive, etc.

##### die
This tells the worker to die.  The worker will acknowlege this message with a DIE: response and then terminate.
When this message is sent by Worker.terminate(), a timer is set.  If the response from the worker takes longer than the timeout time (currently 7 seconds - June 2018) to respond, the socket is closed anyway.

## Typical Session
- `<` means "worker receives"
- `>` means "worker sends"

```
<  {"type":"initWorker","payload":"/**\n *  @file       workerBootstrap.js\n * ....\n})(self.addEventListener, self.removeEventListener, self.postMessage);\n\n// \"evaluated workerBootstrap.js\"\n","origin":"/workerBootstrap.js"}␤
<  {"type":"workerMessage","message":{"request":"eval","data":"\n/**\n *  This file implements BravoJS....stMessage({\n  request: 'workerLoaded'\n})\n"}}␤
>  MSG:{"type":"workerMessage","message":{"request":"workerLoaded"}}␤
>  MSG:{"type":"workerMessage","message":{"request":"evalResult"}}␤
<  {"type":"workerMessage","message":{"request":"eval","data":"console.log(123)\n"}}␤
>  LOG:123␤
>  MSG:{"type":"workerMessage","message":{"request":"evalResult"}}␤
<  {"type":"workerMessage","message":{"request":"eval","data":"console.log(123)\n"}}␤
>  LOG:123␤
>  MSG:{"type":"workerMessage","message":{"request":"evalResult"}}␤
<  {"type":"workerMessage","message":{"request":"eval","data":"postMessage({request: \"complete\"})"}}␤
>  MSG:{"type":"workerMessage","message":{"request":"complete"}}␤
>  MSG:{"type":"workerMessage","message":{"request":"evalResult"}}␤
<  {"type":"die"}␤
>  DIE: Wed Jun 27 2018 13:03:44 GMT-0400 (EDT)␤
>  MSG:{"type":"result","step":"parseMessage","success":true,"origin":"die"}␤
```
