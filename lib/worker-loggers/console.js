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
    this.worker = worker;
    this.supervisor = worker.supervisor;
    this.options = options;
  },

  onSandboxReady(sandbox) {
    const zeroes = '000';
    const shortId = (zeroes + sandbox.id.toString(16).toUpperCase()).slice(-zeroes.length);

    const sandboxData = {
      shortId,
    };

    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Initialized`);

    return sandboxData;
  },

  sandbox$onSliceStart(sandbox, sandboxData, slice) {
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Slice Started - "${sandbox.public.publicName}"`);
  },

  sandbox$onSliceProgress(sandbox, sandboxData, ev) {
    // something
  },
  
  sandbox$onSliceFinish(sandbox, sandboxData, ev) {
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Slice Completed - "${sandbox.public.publicName}"`);
  },
    
  sandbox$onWorkerStop(sandbox, sandboxData, ev) {
    const jobAddress = sandbox.jobAddress ? sandbox.jobAddress.substr(0, 10) : sandbox.jobAddress;
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Terminated - Job address: ${jobAddress}`);
  },

  onPayment({ payment }) {
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
