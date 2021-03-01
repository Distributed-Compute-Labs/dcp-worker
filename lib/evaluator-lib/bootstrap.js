/**
 *  @file       worker/evaluator-lib/bootstrap.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              Final evaluator bootstrap code for defining functions to be used in the work function.
 *
 *  @author     Wes Garland, wes@sparc.network
 *  @date       May 2018
 *  @module     WorkerBootstrap
 */

/* globals self */

self.wrapScriptLoading({ scriptName: 'bootstrap', finalScript: true }, (ring2PostMessage) => {
  let lastProgress = 0,
      postMessageSentTime = 0,
      throttledProgress = 0, // how many progress events were throttled since last update
      indeterminateProgress = true, // If there hasn't been a determinate call to progress since last update
      flushedLastConsoleMessage = false, // flag used to determine if flushedLastLog() was called by client
      lastConsoleMessage = null; // cache of the last message received throguh a console event

  addEventListener('message', async (event) => {
    try {
      var indirectEval = eval // eslint-disable-line
      if (event.data.request === 'eval') {
        try {
          let result = await indirectEval(event.data.data, event.data.filename)
          ring2PostMessage({
            request: `evalResult::${event.data.msgId}`,
            data: result
          })
        } catch (error) {
          ring2PostMessage({
            request: 'error',
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack.replace(
                /data:application\/javascript.*?:/g,
                'eval:'
              ),
            }
          })
        }
      } else if (event.data.request === 'resetState') {
        // This event is fired when the web worker is about to be reused with another slice
        lastProgress = 0;
        postMessageSentTime = 0;
        throttledProgress = 0;
        indeterminateProgress = true;
        flushedLastConsoleMessage = false;
        ring2PostMessage({ request: 'resetStateDone' });
      }
    } catch (error) {
      ring2PostMessage({
        request: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      })
    }
  })

  const emitNoProgress = (message) => {
    lastProgress = null;
    postMessage({
      request: 'noProgress',
      message
    });
  }

  self.progress = function workerBootstrap$progress(value) {
    // lastProgress is set to null when noProgress is emitted,
    // prevents multiple noProgress events from firing
    if (lastProgress === null) return false;

    let progress, isIndeterminate = false;
    if (value === undefined) {
      progress = lastProgress || 0;
      // if progress was set previously, don't show indeterminate
      if (lastProgress === 0) {
        isIndeterminate = true;
      }
    } else {
      progress = parseFloat(value);

      if (Number.isNaN(progress)) {
        isIndeterminate = true;
      } else {
        if (!(typeof value === 'string' && value.endsWith('%'))) {
          // if the progres value isn't a string ending with % then multiply it by 100
          progress *= 100;
        }
      }
    }

    if (progress < 0 || progress > 100) {
      emitNoProgress(`Progress out of bounds: ${progress.toFixed(1)}%, last: ${lastProgress.toFixed(1)}%`);
      return false;
    } else if (progress < lastProgress) {
      // Nerf reverse progress error, mark as indeterminate // RR Jan 2020
      progress = lastProgress;
      isIndeterminate = true;
    }

    if (!Number.isNaN(progress))
      lastProgress = progress;
    
    if (!self.dcpConfig)
      self.dcpConfig = {};
    if (!self.dcpConfig.worker)
      self.dcpConfig.worker = {};
    if (!self.dcpConfig.worker.sandbox)
      self.dcpConfig.worker.sandbox = {};
    if (!self.dcpConfig.worker.sandbox.progressThrottle)
      self.dcpConfig.worker.sandbox.progressThrottle = 0.1;
    
    indeterminateProgress &= isIndeterminate;
    const throttleTime = self.dcpConfig.worker.sandbox.progressThrottle * 1000;
    if (Date.now() - postMessageSentTime >= throttleTime) {
      postMessageSentTime = Date.now();
      postMessage({
        request: 'progress',
        progress: lastProgress,
        value, // raw value
        indeterminate: indeterminateProgress,
        throttledReports: throttledProgress,
      });

      throttledProgress = 0;
      indeterminateProgress = true;
    } else {
      throttledProgress++;
    }

    flushConsoleMessages(null);
    return true;
  }

  function workerBootstrap$work$emit(eventName, value) {
    if (typeof eventName !== 'string') {
      throw new Error(`Event name passed to work.emit must be a string, not ${eventName}.`);
    }

    postMessage({
      request: 'emitEvent',
      payload: {
        eventName,
        data: value,
      },
    });
  }

  self.work = {
    emit: workerBootstrap$work$emit,
    job: {
      public: {}
    }
  };

  function workerBootstrap$console(level, ...args) {
    let message = args.map(a =>
      (typeof a === 'string'? a : JSON.stringify(a))
    ).join(' ');

    flushConsoleMessages({
        level,
        message,
        fileName: undefined,
        lineNumber: undefined});
  }

  self.console = {
    log:    workerBootstrap$console.bind(null, 'log'),
    debug:  workerBootstrap$console.bind(null, 'debug'),
    info:   workerBootstrap$console.bind(null, 'info'),
    warn:   workerBootstrap$console.bind(null, 'warn'),
    error:  workerBootstrap$console.bind(null, 'error'),
  };

  // Function caches the most recent console message and counts how many identical messages are received
  // Once a different message is received (or when the slice completes) it is sent along with the counter value
  function flushConsoleMessages(data){
    if(lastConsoleMessage != null && data != null && lastConsoleMessage.message == data.message && lastConsoleMessage.level == data.level){
      lastConsoleMessage.same++;
    } else {
      if(lastConsoleMessage != null){
        postMessage({
          request: 'console',
          payload: lastConsoleMessage
        });
        lastConsoleMessage = null;
      }

      if(data != null){
        data.same = 1;
        lastConsoleMessage = data;
      }
    }
  };

  self.flushLastLog = function workerBootstrap$flushLastLog(){
    if(!flushedLastConsoleMessage){
        flushConsoleMessages(null); 
        flushedLastConsoleMessage = true;
    } else{
      throw new Error('client should not be calling flushLastLog');
    }
  }
});
