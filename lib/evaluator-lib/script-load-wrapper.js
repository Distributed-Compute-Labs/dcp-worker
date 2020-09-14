/** 
 *  @file       evaluator-lib/script-load-wrapper.js
 * 
 *  This file provides a global function for all proceeding scripts to wrap their
 *  initialization. It will post messages about the success/failure of the script
 *  and handles wrapping of post message when the flag is set.
 * 
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       September 2020
 */

(() => {
  let currentRing = -1;
  function wrapPostMessage() {
    const currentPostMessage = self.postMessage;
    const ringSource = ++currentRing;
    return self.postMessage = function (value) {
      currentPostMessage({ ringSource, value });
    }
  }

  const ring0PostMessage = wrapPostMessage();

  /**
   * This function is used by evaluator scripts to wrap their evaluation so that
   * errors can be caught and reported, and to discourage pollution of the global
   * scope by enclosing them in a function scope.
   * 
   * @param {object} options
   * @param {string} options.scriptName The name of the script that is being loaded
   * @param {boolean} [options.ringTransition] When true, the global postMessage ring will be incremented before the function is invoked
   * @param {boolean} [options.finalScript] When true, the wrapScriptLoading function will be removed from the global scope afterwards
   * @param {function} fn
   */
  self.wrapScriptLoading = function scriptLoadWrapper$wrapScriptLoading(options, fn) {
    try {
      // capture the current postMessage before transitioning rings
      const fixedPostMessage = self.postMessage;
      if (options.ringTransition) {
        wrapPostMessage();
      }

      fn(fixedPostMessage, wrapPostMessage);

      ring0PostMessage({
        request: 'scriptLoaded',
        script: options.scriptName,
        result: "success",
      });

      if (options.finalScript) {
        delete self.wrapScriptLoading;

        ring0PostMessage({
          request: 'sandboxLoaded',
        })
      }
    } catch (e) {
      ring0PostMessage({
          request: 'scriptLoaded',
          script: options.scriptName,
          result: "failure",
          error: {
              name: e.name,
              message: e.message,
              stack: e.stack.replace(
                  /data:application\/javascript.*?:/g,
                  'eval:'
              ),
          }
      });
    }
  }
})();

self.wrapScriptLoading({ scriptName: 'script-load-wrapper' }, () => {
  // noop
});
