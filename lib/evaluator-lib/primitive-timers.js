/**
 *  @file       primitive-timers.js
 *              
 *  Intermediate file that takes existing implementations of 
 *  setTimeout, setInterval, clearTimeout, clearInterval from 
 *  "Browser Evaluator" web worker API, & Node, and dumbs them down into
 *  nextTimer() and ontimer methods. 
 * 
 *  This brings the web worker & node implementation of timers on par
 *  with the native(v8) at this stage of sandbox initialization. 
 * 
 *  The web worker API & node provide the following on the global object 
 *  when this program is evaluated:
 *  - setTimeout(callback, time)    Standard browser setTimeout()      
 *  - clearTimeout(timer)           Standard browser clearTimeout() 
 *  & more
 * 
 *  Once this file has run, the following methods will be
 *  available on the global object:
 *  - ontimer()                     takes a callback function which will be invoked by the reactor when 
 *                                  there are timers that should need servicing based on 
 *                                  the information provided to nextTimer().    
 *  - nextTimer()                   method for setting when the next timer should fire
 *  - evalTimer()                   method which uses setImmediate to evaluate a function. Needed so that
 *                                  the callback function can use the actual setImmediate to run
 *                                  a function.
 *
 *  @author     Parker Rowe, parker@kingsds.network
 *  @date       August 2020
 * 
 *  @note       Unusual function scoping is done to eliminate spurious symbols
 *              from being accessible from the global object, to mitigate
 *              certain classes of security risks.  The global object here is
 *              the top of the scope chain (ie global object) for all code run
 *              by hosts in this environment.
 */

/* globals self, setTimeout, setInterval, clearTimeout, clearInterval, & more web worker API globals */

self.wrapScriptLoading({ scriptName: 'primitive-timers' }, () => {

  /**
   *  Using these temporary variables for old functions to 
   *  make sure that when they are used we are using the actual 
   *  functions. This is due to a bug found where we were incidentally
   *  using our polyfilled setTimeout which lead to recursive 
   *  infinite calls.
  **/
  let _setTimeout   = self.setTimeout;
  let _clearTimeout = self.clearTimeout;
  let _setImmediate = self.setImmediate;

  if (typeof _setImmediate === 'undefined'){
    _setImmediate = (fn)=>{ _setTimeout(fn, 0); };
  };
  
  
  
  (function privateScope(setTimeout, clearTimeout, setImmediate) {
    let nextTimerTimeout = null;
    let onTimerCallback  = null;

    self.evalTimer  = (fn)      => { setImmediate(fn); };
    self.ontimer    = (handler) => { onTimerCallback = handler };
    self.nextTimer  = (when)    => {
      if (nextTimerTimeout) {
        clearTimeout(nextTimerTimeout);
        nextTimerTimeout = null;
      }

      if (when <= Date.now()) {
        try {
          if (onTimerCallback) onTimerCallback();
        } catch (e) {
          console.error(e);
        }
      } else {
        nextTimerTimeout = setTimeout(() => {
          if (onTimerCallback) onTimerCallback();
        }, when - Date.now());
      }
    };
  })(_setTimeout, _clearTimeout, _setImmediate);

  setTimeout = clearTimeout = setInterval = clearInterval = queueMicrotask = undefined;
  delete self.setTimeout;
  delete self.setImmediate;
  delete self.clearTimeout;
  delete self.setInterval;
  delete self.clearInterval;
  delete self.queueMicrotask;
});
