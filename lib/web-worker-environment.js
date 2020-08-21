/** @file       web-worker-environment.js 
 *              A simulated WebWorker evaluator environment.
 *
 *  Control logic for the evaluator which runs in the native or node evaluator.
 *  This environment is designed so that no I/O etc is permitted, beyond
 *  communication with stdin and stdout using a well-defined protocol, exposed
 *  via a WebWorker-like API using postMessage etc.
 *
 *  The evaluator provides the following API on the global object when this
 *  program is evaluated:
 *  - writeln('string')         Write a message to stdout.
 *  - onreadln(function)        Dispatch function, with a single string
 *                              argument, when a message is received on stdin.
 *                              Each string is a single JSON-serialized object.
 *  - nextTimer(number)         Notify the host environment when the next timer
 *                              should be run.
 *  - ontimer(function)         Dispatch function when we think a timer might
 *                              be ready to run.
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

/* globals writeln, onreadln, nextTimer, ontimer, die */

var debug = false

try {
  (function privateScope(writeln, onreadln) {
    var line
    var inMsg, outMsg

    var isInitialized = false;

    /** Send a message to stdout.
     *  This defines the "from evaluator" half of the protocol.
     */
    function send (outMsg) {
      outMsg = JSON.stringify(outMsg)
      writeln('MSG:' + outMsg)
    }

    /** Receive a line from stdin.
     *  This defines the "to evaluator" half of the protocol.
     */
    onreadln(function receiveLine(line) {
      try {
        outMsg = { type: 'result', step: 'parseInput::' + JSON.parse.name, success: false }
        inMsg = JSON.parse(line)
        outMsg.origin = inMsg.type
        outMsg.step = inMsg.type || 'parseMessage'
        switch (inMsg.type) {
        default:
          throw new Error("Invalid message type '" + (typeof inMsg.type === 'string' ? inMsg.type : JSON.stringify(inMsg.type)) + "'")
        case 'initWorker':
          if (isInitialized) { throw new Error('have already initialized worker') }
          /* disabled for perf reasons, wg mar-2018 // writeln("SRC: " + inMsg.payload.split("\n").join("\nSRC: ")); */
          const indirectEval = this.indirectEval || eval // eslint-disable-line
          outMsg.result = indirectEval(inMsg.payload, inMsg.filename)
          outMsg.success = true

          isInitialized = true;
          break
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
  })(writeln, onreadln) /* privateScope */

  'sa-worker-bootstrap: Ready.' // eslint-disable-line
} catch (e) {
  'sa-worker-bootstrap: Uncaught Exception: ' + e.message + ' at ' + e.fileName + ':' + e.lineNumber  // eslint-disable-line
}
