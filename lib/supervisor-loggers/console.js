/**
 *  @file       supervisor-loggers/console.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This supervisor logger uses console.log to produce
 *  simple log output.
 */

require('./common-types');

/** @type {SupervisorLogger} */
const consoleLogger = {
  init(supervisor, options) {
    this.supervisor = supervisor;
    this.options = options;
  },

  onSandboxStart(sandbox) {
    const zeroes = '000';
    const shortId = (zeroes + sandbox.id.toString(16).toUpperCase()).slice(-zeroes.length);

    const workerData = {
      shortId,
    };

    console.log(` ~ [Sandbox 0x${workerData.shortId}] Initialized`);

    return workerData;
  },

  sandbox$onSliceStart(sandbox, workerData, slice) {
    console.log(` ~ [Sandbox 0x${workerData.shortId}] Slice Started - "${sandbox.public.publicName}"`);
  },

  sandbox$onSliceProgress(sandbox, workerData, ev) {
    // something
  },
  
  sandbox$onSliceFinish(sandbox, workerData, ev) {
    console.log(` ~ [Sandbox 0x${workerData.shortId}] Slice Completed - "${sandbox.public.publicName}"`);
  },
    
  sandbox$onWorkerStop(sandbox, workerData, ev) {
    const jobAddress = sandbox.jobAddress ? sandbox.jobAddress.substr(0, 10) : sandbox.jobAddress;
    console.log(` ~ [Sandbox 0x${workerData.shortId}] Terminated - Job address: ${jobAddress}`);
  },

  onDccCredit({ payment }) {
    try {
      payment = parseFloat(payment);
    } catch (e) {
      console.error("Failed to parse payment float:", payment);
      return;
    }

    console.log(`DCC Credit: ${payment}`);
  },

  onFetchingSlices() {
    this.options.verbose && console.log("Fetching slices...");
  },

  onFetchedSlices(ev) {
    this.options.verbose && console.log("Finished fetching slices", ev);
  },

  onFetchSlicesFailed(ev) {
    this.options.verbose && console.log("Failed to fetch slices", ev);
  },
};

Object.assign(exports, consoleLogger);
