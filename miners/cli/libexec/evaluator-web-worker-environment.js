/**
 *  @file evaluator-web-worker-environment.js  Simulated WebWorker environment for evaluators.
 *
 *  Control logic for the evaluator which runs in evaluator-v8, evaluator-node, etc. 
 *  This environment is designed so that no I/O etc is permitted, beyond communication with
 *  stdin and stdout using a well-defined protocol, exposed via a WebWorker-like API using
 *  postMessage etc.
 *
 *  The host environment must provide the following API on the global object when this program
 *  is evaluated:
 *  - writeln('string')         Write a message to stdout.
 *  - onreadln(function)        Displatch function, with a single string argument, when the
 *                              a message is received on stdin. Each string is a single 
 *                              JSON-serialized object.
 *  - nextTimer(number)         Notify the host environment when the next timer should be run.
 *  - ontimer(function)         Dispatch function when we think a timer might be ready to run.
 *  - die()                     Tell the host environment that it's time to end it all.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       March 2018
 *
 *  *note* - Unusual function scoping is done to eliminate spurious symbols from
 *           being accessible from the global object, to mitigate certain classes
 *           of security risks.  The global object here is the top of the scope
 *           chain (ie global object) for all code run by hosts in this environment.
 */

/* globals writeln, onreadln, nextTimer, ontimer, die */

const self = this
var debug = false
delete self.console

try {
  (function privateScope(writeln, onreadln, nextTimer, ontimer, die) {
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

    var line
    var inMsg, outMsg

    var eventListeners = {}
    var onHandlerTypes = ['message', 'error']
    var onHandlers = {}
    var timers = []
    var indirectEval = null
    var serialize = JSON.stringify
    var deserialize = JSON.parse

    self.postMessage = function workerControl$$Worker$postMessage(message) {
      send({type: 'workerMessage', message: message})
    }

    self.addEventListener = function workerControl$$Worker$addEventListener(type, listener) {
      if (typeof eventListeners[type] === 'undefined') { eventListeners[type] = [] }
      eventListeners[type].push(listener)
    }

    self.removeEventListener = function workerControl$$Worker$removeEventListener(type, listener) {
      if (typeof eventListeners[type] === 'undefined') { return }

      const i = eventListeners[type].indexOf(listener)
      if (i !== -1) { eventListeners[type].splice(i, 1) }
    }

    for (let i = 0; i < onHandlerTypes.length; ++i) {
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

    /* Fire any timers which are ready to run, being careful not to
     * get into a recurring timer death loop without reactor mediation.
     */
    ontimer(function fireTimerCallbacks() {
      let now = Date.now()

      timers.sort(function(a, b) { return b.time - a.time })
      for (let i = 0; i < timers.length; ++i) {
        if (timers[i].time <= now) {
          Promise.resolve().then(timers[i].fn)
          if (timers[i].recur) {
            timers[i].time = Date.now() + timers[i].recur;
          } else {
            timers.splice(i--, 1)
          }
        } else {
          break
        }
      }
      timers.sort(function(a, b) { return b.time - a.time })
      nextTimer(timers[0].time)
    })

    /** Execute callback after at least timeout ms. 
     *  @returns    A value which may be used as the timeoutId parameter of clearTimeout()
     */
    self.setTimeout = function workerControl$$Worker$setTimeout(callback, timeout) {
      let timer
      if (typeof callback === 'string') {
        let code = callback
        callback = function workerControl$$Worker$setTimeout$wrapper() {
          let indirectEval = eval
          return indirectEval(code)
        }
      }
      
      timers.serial = +timers.serial + 1;
      timer = {
        fn: callback,
        time: Date.now() + (+timeout || 0),
        serial: timers.serial,
        valueOf: function() { return this.serial }
      }
      timers.push(timer)
      if (timer.time <= timers[0].time) {
        timers.sort(function(a, b) { return a.time - b.time })
        nextTimer(timers[0].time)
      }
      return timer
    }

    /** Remove a timeout from the list of pending timeouts, regardless of its current
     *  status.
     *
     *  @param       timeoutId     The value, returned from setTimeout(), identifying the timer.
     */
    self.clearTimeout = function workerControl$$Worker$clearTimeout(timeoutId) {
      if (typeof timeoutId === "object") {
        let i = timers.indexOf(timeoutId)
        if (i != -1) {
          timers.splice(i, 1)
        }
      } else if (typeof timeoutId === "number") { /* slow path - object has been reinterpreted in terms of valueOf() */
        for (let i = 0; i < timers.length; ++i) {
          if (timers[i].serial === timeoutId) {
            timers.splice(i, 1)
            break
          }
        }
      }
    }

    /** Execute callback after at least interval ms, regularly, at least interval ms apart.
     *  @returns    A value which may be used as the intervalId paramter of clearInterval()
     */
    self.setInterval = function workerControl$$Worker$setInterval(callback, interval) {
      let timer = self.setTimeout(callback, +interval || 0)
      timer.recur = interval 
      return timer
    }

    /** Remove an interval timer from the list of pending interval timers, regardless of its current
     *  status.
     *
     *  @param       intervalId     The value, returned from setInterval(), identifying the timer.
     */
    self.clearInterval = self.clearTimeout

    /** Near-polyfill for window.requestAnimationFrame, running as fast as the SET_TIMEOUT_CLAMP 
     *  will allow in the host environment.
     *  @returns    A value which may be used as the timeoutId parameter of cancelAnimationFrame()
     *  @note       The spec requires that the return value is a long; however, we are using an object 
     *              which has a long value
     */
    self.requestAnimationFrame = function workerControl$$Worker$requestAnimationFrame(callback) {
      let timer = self.setTimeout(callback, 0)
      timers.unshift(timers.splice(timers.indexOf(timer), 1)[0])
      nextTimer() // now
    }

    /** Remove a pending request for an animation frame. */
    self.cancelAnimationFrame = self.clearTimeout 

    /** Emit an event */
    function emitEvent(eventName, argument) {
      if (eventListeners[eventName]) {
        for (let i = 0; i < eventListeners[eventName].length; ++i) {
          eventListeners[eventName][i].call(self, argument)
        }
      }
    }

    /** Send a message to stdout. If the message is sent
     *  before we are (the worker is) ready, the message is queued up
     *  and sent later.  Later would be another call to send(), and
     *  hopefully triggered by the worker becoming ready.
     */
    function send(outMsg) {
      outMsg = serialize(outMsg)
      writeln('MSG:' + outMsg)
    }

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
        case 'initWorker':
          if (indirectEval) { throw new Error('have already initialized worker on this socket') }
          /* disabled for perf reasons, wg mar-2018 // writeln("SRC: " + inMsg.payload.split("\n").join("\nSRC: ")); */
          indirectEval = self.indirectEval || eval // eslint-disable-line
          outMsg.result = indirectEval(inMsg.payload, inMsg.filename)
          outMsg.success = true
          break
        case 'workerMessage':
          if (!indirectEval) {
            throw new Error('Must initWorker before posting messages')
          }
          emitEvent('message', {data: inMsg.message})
          outMsg.success = true
          break
        case 'die':
          writeln('DIE: ' + Date())
          outMsg.success = true
          die();
          break;
        } /*esac */
      } catch (e) {
        /* Return exceptions thrown in this engine (presumably the host code) to stdout for reporting. */
        outMsg.success = false
        outMsg.exception = { name: e.name, message: e.message, fileName: e.fileName, lineNumber: e.lineNumber, stack: e.stack }
        outMsg.e = e
      } finally {
        send(outMsg)
      }
    }) /* receiveLine */
  })(writeln, onreadln, nextTimer, ontimer, die) /* privateScope */

  writeln = onreadln = nextTimer = ontimer = die = undefined
  delete self.writeln
  delete self.onreadln
  delete self.nextTimer
  delete self.ontimer
  delete self.die
  'evaluator-web-worker-environment: Ready.' // eslint-disable-line
} catch (e) {
  'evaluator-web-worker-environment: Uncaught Exception: ' + e.message + ' at ' + e.fileName + ':' + e.lineNumber  // eslint-disable-line
}
