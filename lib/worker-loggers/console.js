/**
 *  @file       worker-loggers/console.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This worker logger uses console.log to produce
 *  simple log output.
 */

require('./common-types');

/**
 * When this.enhancedDisplay is true
 *   Sandbox   1:  Slice Started:   slice 1, 0x5b5214D48F0428669c4E: Simple Job
 *   Sandbox   1:  Slice Completed: slice 1, 0x5b5214D48F0428669c4E: Simple Job: dt 114ms
 * When this.enhancedDisplay is false
 *   Sandbox   1:  Slice Started:   0x5b5214D48F0428669c4E68779896D29D77c42903 Simple Job
 *   Sandbox   1:  Slice Completed: 0x5b5214D48F0428669c4E68779896D29D77c42903 Simple Job
 * @type {WorkerLogger}
 */
const consoleLogger = {
  init(worker, options) {
    this.worker = worker;
    this.options = Object.assign({}, options);
    this.sliceMap = {};          // jobAddress --> ( sliceNumber, t0 )
    this.enhancedDisplay = true; // When false, no timing, no sliceNumber, full jobAddress
    this.truncationLength = 22;  // Extra 2 for '0x'
  },

  id (sandbox, sliceNumber) {
    if (!this.enhancedDisplay)
      return sandbox.public ? `${sandbox.jobAddress} ${sandbox.public.name}` : `${sandbox.jobAddress}`;

    const address = sandbox.jobAddress ? sandbox.jobAddress.slice(0, this.truncationLength) : 'null';
    const baseInfo = sandbox.public ? `${address}: ${sandbox.public.name}` : `${address}:`;
    if (!sliceNumber && sandbox.slice)
      sliceNumber = sandbox.slice.sliceNumber;
    return sliceNumber ? `slice ${sliceNumber}, ${baseInfo}` : baseInfo;
  },

  onSandboxReady(sandbox) {
    const shortId = sandbox.id.toString(10).padStart(3);

    const sandboxData = {
      shortId,
    };

    console.log(` * Sandbox ${sandboxData.shortId}:  Initialized`);

    return sandboxData;
  },

  sandbox$onSliceStart(sandbox, sandboxData, ev) {
    this.sliceMap[sandbox.id] = { slice: sandbox.slice.sliceNumber, t0: Date.now() };
    console.log(` * Sandbox ${sandboxData.shortId}:  Slice Started:   ${this.id(sandbox)}`);
  },

  sandbox$onSliceProgress(sandbox, sandboxData, ev) {
    // something
  },

  sandbox$onSliceFinish(sandbox, sandboxData, ev) {
    const sliceInfo = this.sliceMap[sandbox.id];
    if (sliceInfo && this.enhancedDisplay)
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${this.id(sandbox, sliceInfo.slice)}: dt ${Date.now() - sliceInfo.t0}ms`);
    else
      console.log(` * Sandbox ${sandboxData.shortId}:  Slice Completed: ${this.id(sandbox)}`);
  },

  sandbox$onWorkerStop(sandbox, sandboxData, ev) {
    const sliceInfo = this.sliceMap[sandbox.id];
    delete this.sliceMap[sandbox.id];
    console.log(` * Sandbox ${sandboxData.shortId}:  Terminated:      ${this.id(sandbox, sliceInfo?.slice)}`);
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
    this.options.verbose && console.log(" * Fetched", ev);
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
};

Object.assign(exports, consoleLogger);
