/**
 *  @file       default-event.js
 *              Default worker/sandbox events, providing default logging behaviours (event handlers)
 *              for the dcp-worker.
 *
 *              - All event handlers use the *current* global console object to emit messages;
 *                enhanced logging subsystems should intercept this object to achieve their desired
 *                behaviours.
 *
 *              - All event handlers invoke functions which are properties of the eventHandlers return
 *                value from the hook function. This means that alternate user interfaces can either
 *                hook or intercept the properties of that object to modify the event handlers'
 *                behaviour without actually removing/replacing the event handler on the instance of
 *                Worker.
 *
 *              NOTE: This is just a convenience module. There is no requirement to use this module to
 *                    hook worker events, this module mainly exists to make it easy for the
 *                    dashboard-tui to replace event handlers with better ones, but it also makes it
 *                    easier to sandbox events since we only need to register one event handler here
 *                    to handle every sandbox.
 *
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 *  @author     Wes Garland, wes@distributive.network
 *  @date       June 2023
 */
'use strict';

const sandboxEventHandlers = {};
const workerEventHandlers = {};

/**
 *   Sandbox   1:  Slice Started:   slice 1, 0x5b5214D48F0428669c4E: Simple Job
 *   Sandbox   1:  Slice Completed: slice 1, 0x5b5214D48F0428669c4E: Simple Job: dt 114ms
 */

/**
 * @param    worker    The instance of Worker to hook
 * @param    options   cliArgs from worker
 */
exports.hook = function hookWorkerEvents$$hook(worker, options)
{
  const sliceMap = {};          // jobAddress --> ( sliceNumber, t0 )
  const truncationLength = 22;  // Extra 2 for '0x'

  delete exports.hook;

  function makeSliceId (sandbox, sliceNumber)
  {
    if (!sandbox.jobAddress)
      return '<no job>';
    
    const address = sandbox.jobAddress ? sandbox.jobAddress.slice(0, truncationLength) : 'null';
    const baseInfo = sandbox.public?.name ? `${address}: ${sandbox.public.name}` : `${address}`;

    if (!sliceNumber)
      sliceNumber = sandbox.slice ? sandbox.slice.sliceNumber : 0;
    return sliceNumber ? `slice ${sliceNumber}, ${baseInfo}` : baseInfo;
  }

  sandboxEventHandlers.ready = function sandboxReadyHandler(sandbox, sandboxData, ev) {
    console.log(` . Sandbox ${sandboxData.shortId}:  Initialized`);
  };


  sandboxEventHandlers.slice = function sliceHandler(sandbox, sandboxData, ev) {
    const sliceNumber = sandbox.slice ? sandbox.slice.sliceNumber : 0;
    sliceMap[sandbox.id] = { slice: sliceNumber, t0: Date.now() };
    console.log(` . Sandbox ${sandboxData.shortId}:  Slice Started:   ${makeSliceId(sandbox)}`);
  };

  // Create blank functions for the events used in TUI, so they can be changed if the TUI is started

  sandboxEventHandlers.progress = function progressHandler(sandbox, sandboxdData, ev) {
    // NOP
  };

  sandboxEventHandlers.job = function jobHandler(sandbox, sandboxData, ev) {
    // NOP
  };

  sandboxEventHandlers.sliceEnd = function sliceEndHandler(sandbox, sandboxData, ev) {
    const sliceInfo = sliceMap[sandbox.id];
    if (sliceInfo)
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${makeSliceId(sandbox, sliceInfo.slice)}: dt ${Date.now() - sliceInfo.t0}ms`);
    else
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${makeSliceId(sandbox)}`);

    delete sliceMap[sandbox.id];
  };

  workerEventHandlers.payment = function paymentHandler(ev) {
    const payment = ev;

    if (isNaN(payment))
      console.error(' ! Failed to parse payment:', payment);
    else
      console.log(` . Payment: ${payment} ⊇`);
  };

  workerEventHandlers.beforeFetch = function beforeFetchHandler() {
    options.verbose && console.log(' * Fetching slices...');
  };

  workerEventHandlers.fetch = function fetchHandler(ev) {
    var slicesFetched;

    if (ev instanceof Error)
    {
      console.error(' ! Failed to fetch slices:', ev);
      return;
    }

    if (typeof ev === 'number' || typeof ev === 'string') /* <= June 2023 Worker events: remove ~ Sep 2023 /wg */
      slicesFetched = ev;
    else
    {
      const task = ev;
      slicesFetched = 0;
      for (const job in task.slices)
      {
        slicesFetched+= task.slices[job];
      }
      
    }

    options.verbose && console.log(' . Fetched', slicesFetched, 'slices');
  };


  // workerEventHandlers.beforeResult = function beforeResultHandler() {
  //   options.verbose && console.log(' * Submitting results...');
  // };

  // workerEventHandlers.result = function resultHandler() {
  //   options.verbose && console.log(' . Submitted');
  // };

  workerEventHandlers.submitError = function submitErrorHandler(ev) {
    console.log(' ! Failed to submit results:', ev);
  };

  /* Register the appropriate event handlers on the worker and on each sandbox. The handlers are
   * registered in such a way that mutating the exports object to supply different handlers after
   * registration will work.
   *
   * The handlers registered on each sandbox receive two extra arguments before the usual event
   * arguments; these are the sandbox handle emitted by the Worker<sandbox> event and an object
   * called `sandboxData` which is just arbitrary storage for the eventHandlers' use, eg for memos.
   */
  for (let eventName in workerEventHandlers)
    worker.on(eventName, (...args) => workerEventHandlers[eventName](...args));

  worker.on('sandbox', function newSandboxHandler(sandbox) {
    const sandboxData = {
      shortId: sandbox.id.toString(10).padStart(3)
    };
    for (let eventName in sandboxEventHandlers)
      sandbox.on(eventName, (...args) => sandboxEventHandlers[eventName](sandbox, sandboxData, ...args));
  });
  
  exports.sandboxEventHandlers = sandboxEventHandlers;
  exports.workerEventHandlers  = workerEventHandlers;
};

/**
 * Function to replace a worker event handler.
 *
 * @param {string}   eventName          name of the event to replace
 * @param {function} eventHandler       new event handler
 */
exports.replaceWorkerEvent = function hookWorkerEvents$$replace(eventName, eventHandler)
{
  if (!workerEventHandlers.hasOwnProperty(eventName))
    throw new Error('unknown worker event: ' + eventName + `(${Object.keys(workerEventHandlers).join(', ')})`);

  workerEventHandlers[eventName] = eventHandler;
}

/**
 * Function to replace a sandbox event handler.
 *
 * @param {string}   eventName          name of the event to replace
 * @param {function} eventHandler       new event handler
 */
exports.replaceSandboxEvent = function hookSandboxEvents$$replace(eventName, eventHandler)
{
  if (!sandboxEventHandlers.hasOwnProperty(eventName))
    throw new Error('unknown sandbox event: ' + eventName + `(${Object.keys(sandboxEventHandlers).join(', ')})`);

  sandboxEventHandlers[eventName] = eventHandler;
}
