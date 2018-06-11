/**
 *  @file       dcp-miner-control.js    Control logic for the DCP miner which runs
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
 *
 *  @note Unusual function scoping is done to eliminate spurious symbols from 
 *        being accessible from the global object, to mitigate certain classes
 *        of security risks.  The global object here is the top of the scope
 *        chain (ie global object) for all code run by hosts in this environment.
 */

var postMessage;

try {
(function(_readln, _writeln)
{
  delete readln, writeln;

  /** implement console.log which propogates messages back to the standaloneWorker */
  var console = { log: function minerControl$$log() { _writeln("LOG:" + Array.prototype.slice.call(arguments).join(" "));}};

  function Worker(code)
  {
    /* Very important to ensure the only thing on the scope chain for the
     * eval'd code is the global object, which has already been stripped
     * of symbols which are not part of the standard classes.
     */
    if (!this instanceof Worker)
      throw new Error("Worker must only be invoked as a constructor");
    
    postMessage = this.postMessage;
    console.log("dcp-miner-control - Begin");
    eval(code);
  }       

  (function()
   {
    var line;
    var inMsg, outMsg;
    var pendingMessages = [];

    var worker;
    var eventListeners = {};
    var onHandlerTypes = ["message", "error"];
    var onHandlers={};

    Worker.prototype.postMessage = function minerControl$$Worker$postMessage(message)
    {
      console.log("Returning result", JSON.stringify(message));
      pendingMessages.push(message);
      return;
    };
    
    Worker.prototype.addEventListener = function minerControl$$Worker$addEventListener(type, listener)
    {
      if (typeof eventListeners[type] === "undefined")
        eventListeners[type] = [];
      eventListeners[type].push(listener);
    }

    Worker.prototype.removeEventListener = function minerControl$$Worker$removeEventListener(type, listener)
    {
      var i;
    
      if (typeof eventListeners[type] === "undefined")
        return;

      i = eventListeners[type].indexOf(listener);
      if (i != -1)
        eventListeners[type].splice(i,1);
    }

    for (let i=0; i < onHandlerTypes.length; i++)
    {
      let onHandlerType = onHandlerTypes[i];
      Object.defineProperty(Worker.prototype, "on" + onHandlerType,
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
    
    function send(outMsg)
    {
      _writeln("MSG:" + JSON.stringify(outMsg));
    }
    
    function flushPendingMessages()
    {
      while (worker && pendingMessages.length)
        send({type: "workerMessage", message: pendingMessages.shift()});
    }
    
    try
    {
      loop: while ((line = _readln()))
      {
        outMsg = { type: "result", step: "parseInput", success: false };
        inMsg  = JSON.parse(line);

        outMsg.origin = inMsg.type;
        outMsg.step   = "parseMessage";

        switch(inMsg.type)
        {
          default:
           throw new Error("Invalid message type '" + inMsg.type + "'");
            break;
          case "newWorker":
            if (worker)
              throw new Error("Already have a worker on this socket");
            /* disabled for perf reasons, wg mar-2018 // _writeln("SRC: " + inMsg.payload.split("\n").join("\nSRC: ")); */
            worker = new Worker(inMsg.payload);
            outMsg.success = true;
            break;
          case "workerMessage":
            if (!worker)
              throw new Error("Cannot send a message to worker which does not exist");

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
