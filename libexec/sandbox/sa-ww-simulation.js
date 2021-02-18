/** @file       sa-ww-simulation.js 
 *              A simulated WebWorker evaluator environment.
 *
 *  Takes onreadln, writeln & more from the native & node evaluators 
 *  and implements web worker API functionality.
 *  This environment is designed so that no I/O etc is permitted, beyond
 *  communication with stdin and stdout using a well-defined protocol, exposed
 *  via a WebWorker-like API using postMessage etc.
 *
 *  The native & node evaluators provide the following API on the global object when this
 *  program is evaluated:
 *  - writeln('string')         Write a message to stdout.
 *  - onreadln(function)        Dispatch function, with a single string
 *                              argument, when a message is received on stdin.
 *                              Each string is a single JSON-serialized object.
 *  - die()                     Tell the host environment that it's time to end
 *                              it all.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       March 2018
 *
 *  @note       Unusual function scoping is done to eliminate spurious symbols
 *              from being accessible from the global object, to mitigate
 *              certain classes of security risks.  The global object here is
 *              the top of the scope chain (ie global object) for all code run
 *              by hosts in this environment.
 */

/* globals writeln, onreadln, die */
// @ts-nocheck

/**
 * self is a localscope reference to the global object. All subsequent files run
 * after this one will have localscope access to 'self'. This is done to emulate
 * web workers which already have self defined. 
 */
const self = this;
var debug = false;
delete self.console;

try {
  (function privateScope(writeln, onreadln, die) {
    /* Implement console.log which propagates messages to stdout. */
    var console = {
      log: function workerControl$$log () {
        writeln('LOG:' + Array.prototype.slice.call(arguments).join(' ').replace(/\n/g,"\u2424"))
      }
    }

    self._console = console
    try {
      self.console = console
      console.debug = console.log
      console.error = console.log
      console.warn = console.log
    } catch (e) {}

    var inMsg, outMsg

    var eventListeners = {}
    var onHandlerTypes = ['message', 'error']
    var onHandlers = {}
    var serialize = JSON.stringify
    var deserialize = JSON.parse

    self.postMessage = function workerControl$$Worker$postMessage (message) {
      send({type: 'workerMessage', message });
    }

    self.addEventListener = function workerControl$$Worker$addEventListener (type, listener) {
      if (typeof eventListeners[type] === 'undefined') { eventListeners[type] = [] }
      eventListeners[type].push(listener)
    }

    self.removeEventListener = function workerControl$$Worker$removeEventListener (type, listener) {
      if (typeof eventListeners[type] === 'undefined') { return }

      const i = eventListeners[type].indexOf(listener)
      if (i !== -1) { eventListeners[type].splice(i, 1) }
    }

    for (let i = 0; i < onHandlerTypes.length; i++) {
      let onHandlerType = onHandlerTypes[i]
      Object.defineProperty(self, 'on' + onHandlerType, {
        enumerable: true,
        configurable: false,
        set: function (cb) {
          this.removeEventListener(onHandlerType, onHandlers[onHandlerType])
          this.addEventListener(onHandlerType, cb)
          onHandlers[onHandlerType] = cb
        },
        get: function () {
          return onHandlers[onHandlerType]
        }
      })
    }

    /** Emit an event */
    function emitEvent(eventName, argument) {
      if (eventListeners[eventName]) {
        for (let i = 0; i < eventListeners[eventName].length; i++) {
          eventListeners[eventName][i].call(self, argument)
        }
      }
    }

    /** Send a message to stdout.
     *  This defines the "from evaluator" half of the protocol.
     */
    function send (outMsg) {
      outMsg = serialize(outMsg)
      writeln('MSG:' + outMsg)
    }

    /** Receive a line from stdin.
     *  This defines the "to evaluator" half of the protocol.
     */
    onreadln(function receiveLine(line) {
      try {
        outMsg = { type: 'result', step: 'parseInput::' + deserialize.name, success: false }
        inMsg = deserialize(line)
        outMsg.origin = inMsg.type
        outMsg.step = inMsg.type || 'parseMessage'
        switch (inMsg.type) {
        default:
          throw new Error("Invalid message type '" + (typeof inMsg.type === 'string' ? inMsg.type : JSON.stringify(inMsg.type)) + "'")
        case 'newSerializer':
          outMsg.step = 'changeSerializer'
          let newSerializer = eval(inMsg.payload)
          outMsg.success = true
          send(outMsg) // acknowledge change in old format
          serialize = newSerializer.serialize
          deserialize = newSerializer.deserialize
          outMsg = { type: 'nop', success: true }
          break
        case 'workerMessage':
          emitEvent('message', {data: inMsg.message})
          outMsg.success = true
          break
        case 'die':
          writeln('DIE: ' + Date())
          outMsg.success = true
          die();
          break;
        }
      } catch (e) {
        /* Return exceptions thrown in this engine (presumably the host code) to stdout for reporting. */
        outMsg.success = false
        outMsg.exception = { name: e.name, message: e.message, fileName: e.fileName, lineNumber: e.lineNumber, stack: e.stack }
        outMsg.e = e
      } finally {
        send(outMsg)
      }
    }) /* receiveLine */
  })(writeln, onreadln, die) /* privateScope */

  writeln = onreadln = die = undefined
  delete self.writeln
  delete self.onreadln
  delete self.die

} catch (e) {
  writeln('DIE: ' + e.message);
  die();
}
