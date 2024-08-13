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

const utils = require('../lib/utils');

const sandboxEventHandlers = {};
const workerEventHandlers = {};

function placeholder()
{
  /* event target for events not used by the default loggers */
}

/**
 *  Hook a worker's events and the events of the sandboxes it creates.
 *  
 * @param    worker    The instance of Worker to hook
 * @param    options   cliArgs from worker
 */
exports.hook = function defaultUiEvents$$hook(worker, options)
{
  const sliceMap = {};          // jobAddress --> ( sliceNumber, t0 )
  const truncationLength = 22;  // Extra 2 for '0x'

  delete exports.hook;

  function makeSliceId (sandbox, sliceNumber)
  {
    if (!sandbox.jobAddress)
      return '<no job>';
    
    const address = sandbox.jobAddress.slice(0, truncationLength);
    const baseInfo = sandbox?.public ? `${address}: ${sandbox.public.name}` : address;

    if (!sliceNumber)
      sliceNumber = sandbox.sliceNumber;
    return sliceNumber > 0 ? `slice ${sliceNumber}, ${baseInfo}` : baseInfo;
  }

  sandboxEventHandlers.ready = function sandboxReadyHandler(sandbox, sandboxData, ev) {
    console.log(` . Sandbox ${sandboxData.shortId}:  Initialized`);
  };

  sandboxEventHandlers.slice = function sliceHandler(sandbox, sandboxData, ev) {
    sliceMap[sandbox.id] = { slice: sandbox.sliceNumber, t0: Date.now() };
    console.log(` . Sandbox ${sandboxData.shortId}:  Slice Started:   ${makeSliceId(sandbox)}`);
  };

  sandboxEventHandlers.progress = placeholder;
  sandboxEventHandlers.job      = placeholder;

  sandboxEventHandlers.sliceEnd = function sliceEndHandler(sandbox, sandboxData, ev) {
    const sliceInfo = sliceMap[sandbox.id];
    if (sliceInfo)
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${makeSliceId(sandbox, sliceInfo.slice)}: dt ${Date.now() - sliceInfo.t0}ms`);
    else
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${makeSliceId(sandbox)}`);
  };

  sandboxEventHandlers.end = function endHandler(sandbox,sandboxData, ev) {
    const sliceInfo = sliceMap[sandbox.id];
    console.log(` * Sandbox ${sandboxData.shortId}:  Terminated:      ${makeSliceId(sandbox, sliceInfo?.slice)}`);
    delete sliceMap[sandbox.id];
  };

  workerEventHandlers.payment = function paymentHandler(ev) {
    const payment = parseFloat(ev);

    if (isNaN(payment))
      console.error(' ! Failed to parse payment:', payment);
    else
      console.log(` . Payment: ${payment.toFixed(3)} ⊇`);
  };

  workerEventHandlers.beforeFetch = function beforeFetchHandler() {
    options.verbose && console.log(' * Fetching slices...');
  };

  workerEventHandlers.fetch = function fetchHandler(ev) {
    if (ev instanceof Error)
      console.error(' ! Failed to fetch slices:', ev);
    else
      options.verbose && console.log(' . Fetched', utils.slicesFetched(ev), 'slices');
  };

  workerEventHandlers.beforeResult = function beforeResultHandler() {
    options.verbose >= 2 && console.log(' * Submitting results...');
  };

  workerEventHandlers.result = function resultHandler(ev) {
    if (ev instanceof Error)
      console.error(" ! Failed to submit results:", ev);
    else
      options.verbose >= 2 && console.log(' . Submitted');
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
    const sandboxData = { shortId: sandbox.id.toString(10).padStart(3) };
    for (let eventName in sandboxEventHandlers)
      sandbox.on(eventName, (...args) => sandboxEventHandlers[eventName](sandbox, sandboxData, ...args));
    for (let callback of exports.newSandboxCallbacks)
      callback(worker, sandbox, sandboxData);
  });
  
  exports.sandboxEventHandlers = sandboxEventHandlers;
  exports. workerEventHandlers =  workerEventHandlers;
};

/**
 * Function to replace a worker event handler.
 *
 * @param {string}   eventName          name of the event to replace
 * @param {function} eventHandler       new event handler
 */
exports.replaceWorkerEventHandler = function defaultUiEvents$$replaceWorkerEventHandler(eventName, eventHandler)
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
exports.replaceSandboxEventHandler = function defaultUiEvents$$replaceSandboxEventHandler(eventName, eventHandler)
{
  if (!sandboxEventHandlers.hasOwnProperty(eventName))
    throw new Error('unknown sandbox event: ' + eventName + `(${Object.keys(sandboxEventHandlers).join(', ')})`);

  sandboxEventHandlers[eventName] = eventHandler;
}

/**
 * Functions which are fired every time the worker creates a new sandbox.
 * Each function receives as its arguments worker, sandbox, sandboxData.
 */
exports.newSandboxCallbacks = [];
