/**
 *  @file       dcp-miner-control.js    Simulated worker environment - 
 *                                      Control logic for the DCP miner which runs
 *                                      in dcp-miner-v8 or dcp-miner-jsapi. Reads
 *                                      and writes to stdin/stdout, requires only
 *                                      readln() and writeln() support from the host
 *                                      environment. These should be attached to
 *                                      the global object in such a way that they
 *                                      can be deleted from JS userland.
 *                                      
 *                                      Each line read is a single JSON object.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       March 2018

 *  @note Unusual function scoping is done to eliminate spurious symbols from 
 *        being accessible from the global object, to mitigate certain classes
 *        of security risks.  The global object here is the top of the scope
 *        chain (ie global object) for all code run by hosts in this environment.
 */

const self = this;

try {
(function(_readln, _writeln)
{
  delete readln, writeln;

  /** implement console.log which propagates messages back to the standaloneWorker */
  var console = { log: function minerControl$$log() { _writeln("LOG:" + Array.prototype.slice.call(arguments).join(" "));}};

  (function()
   {
     var line;
     var inMsg, outMsg;
     var pendingMessages = [];

     var worker;
     var eventListeners = {};
     var onHandlerTypes = ["message", "error"];
     var onHandlers={}; 
     var indirectEval = null;

     self.postMessage = function minerControl$$Worker$postMessage(message) {
       console.log("Returning result", JSON.stringify(message));
       pendingMessages.push(message);
       return;
     };
     
     self.addEventListener = function minerControl$$Worker$addEventListener(type, listener) {
       if (typeof eventListeners[type] === "undefined")
         eventListeners[type] = [];
       eventListeners[type].push(listener);
     }

     self.removeEventListener = removeEventListener = function minerControl$$Worker$removeEventListener(type, listener) {
       var i;
       
       if (typeof eventListeners[type] === "undefined")
         return;

       i = eventListeners[type].indexOf(listener);
       if (i != -1)
         eventListeners[type].splice(i,1);
     }

     for (let i=0; i < onHandlerTypes.length; i++) {
       let onHandlerType = onHandlerTypes[i];
       Object.defineProperty(self, "on" + onHandlerType,
			     {
			       enumerable:   true,
			       configurable: false,
			       set: function(cb)
			       {
				 this.removeEventListener(onHandlerType, onHandlers[onHandlerType]);
				 this.addEventListener(onHandlerType, cb);
				 onHandlers[onHandlerType] = cb;
			       },
			       get: function()
			       {
				 onHandlers[onHandlerType];
			       }
			     });
     }

     function send(outMsg) {
       _writeln("MSG:" + JSON.stringify(outMsg));
     }
     
     function flushPendingMessages() {
       while (worker && pendingMessages.length)
         send({type: "workerMessage", message: pendingMessages.shift()});
     }
     
     try {
       loop: while ((line = _readln())) {
         outMsg = { type: "result", step: "parseInput", success: false };
         inMsg  = JSON.parse(line);
         outMsg.origin = inMsg.type;
         outMsg.step   = "parseMessage";

         switch(inMsg.type) {
           default:
             throw new Error("Invalid message type '" + inMsg.type + "'");
             break;
           case "initWorker":
             if (indirectEval)
               throw new Error("have already initialized worker on this socket");
             /* disabled for perf reasons, wg mar-2018 // _writeln("SRC: " + inMsg.payload.split("\n").join("\nSRC: ")); */
	     indirectEval = eval;
	     indirectEval(inMsg.payload);
             outMsg.success = true;
             break;
           case "workerMessage":
             if (!indirectEval)
               throw new Error("Must initWorker before posting messages");
             if (eventListeners["message"])
               for (let i=0; i < eventListeners["message"].length; i++)
                 eventListeners["message"][i].call(worker, {data: inMsg.message});

             outMsg.success = true;
             break;
           case "die":
             _writeln("DIE: " + Date());
             outMsg.success = true;
             break loop;
         }

         flushPendingMessages();
       }
     }
     catch(e)
     {
       /* Return exceptions thrown in this engine (presumably the host code) to the standaloneWorker object for reporting */
       outMsg.success    = false;
       outMsg.exception  = { name: e.name, message: e.message, fileName: e.fileName, lineNumber: e.lineNumber, stack: e.stack };
     }
     finally
     {
       flushPendingMessages();
       send(outMsg);
     }
   })();
})(readln, writeln);
"dcp-miner-control: Normal Exit."
} catch(e) { "dcp-miner-control: Uncaught Exception: " + e.message + " at " + e.fileName + ":" + e.lineNumber }
