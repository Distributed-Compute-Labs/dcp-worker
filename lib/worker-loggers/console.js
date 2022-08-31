/**
 *  @file       worker-loggers/console.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This worker logger uses console.log to produce
 *  simple log output.
 */

require('./common-types');

/** @type {WorkerLogger} */
const consoleLogger = {
  init(worker, options) {
    console.debug('015: initializing consoleLogger...', options);
    this.worker = worker;
    this.supervisor = worker.supervisor;
    this.options = Object.assign({}, options);
  },

  onSandboxReady(sandbox) {
    const shortId = sandbox.id.toString(10).padStart(3);

    const sandboxData = {
      shortId,
    };

    console.log(` * Sandbox ${sandboxData.shortId}:  Initialized`);

    return sandboxData;
  },

  sandbox$onSliceStart(sandbox, sandboxData, slice) {
    console.log(` * Sandbox ${sandboxData.shortId}:  Slice Started:   ${sandbox.jobAddress} ${sandbox.public.name}`);
  },

  sandbox$onSliceProgress(sandbox, sandboxData, ev) {
    // something
  },
  
  sandbox$onSliceFinish(sandbox, sandboxData, ev) {
    console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${sandbox.jobAddress} ${sandbox.public.name}`);
  },

  sandbox$onWorkerStop(sandbox, sandboxData, _event) {
    const job = sandbox.public ? `${sandbox.jobAddress} ${sandbox.public.name}` : sandbox.job;
    console.log(` * Sandbox ${sandboxData.shortId}:  Terminated:      ${job}`);
  },

  onPayment({ payment }) {
    try {
      payment = parseFloat(payment);
    } catch (e) {
      console.error(" ! Failed to parse payment:", payment);
      return;
    }

    if (payment > 0) console.log(` * DCC Credit: ${payment.toFixed(3)}`);
  },

  onFetchingSlices() {
    this.options.verbose && console.log(" * Fetching slices...");
  },

  onFetchedSlices(ev) {
    this.options.verbose && console.log(" * Fetched", ev, 'slices');
  },

  onFetchSlicesFailed(ev) {
    console.log(" ! Failed to fetch slices:", ev);
  },

  onSubmitStart() {
    this.options.verbose >= 2 && console.log(" * Submitting results...");
  },

  onSubmit() {
    this.options.verbose >= 2 && console.log(" * Submitted");
  },

  onSubmitError(ev) {
    console.log(" ! Failed to submit results:", ev);
  },

  onError(ev) {
    this.options.verbose && console.error(" ! Worker error:", ev);
  },

  onWarning(ev) {
    this.options.verbose >= 2 && console.warn(" ! Worker warning:", ev);
  },
};

Object.assign(exports, consoleLogger);
