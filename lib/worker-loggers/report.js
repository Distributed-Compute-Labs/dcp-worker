/**
 *  @file       worker-loggers/report.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       October 2020
 * 
 *  This worker logger produces more verbose console output
 *  than the console logger and will update to a summary
 *  file on an interval.
 */

const fs = require('fs');
require('./common-types');

/** @typedef {object} WorkerReport
 * @property {number} slicesStarted
 * @property {number} slicesCompleted
 * @property {number} slicesFailed
 * @property {number} sandboxesInitialized
 * @property {number} sandboxesTerminated
 */

/** @type {WorkerLogger} */
const reportLogger = {
  init(worker, options) {
    this.worker = worker;
    this.supervisor = worker.supervisor;
    this.options = options;

    /** @type {WorkerReport} */
    this.workerReport = null;
    this.resetWorkerReport();

    console.info(`Report logger configured to write to ${options.reportFile} every ${options.reportInterval / 1000} seconds.`);

    // Write header
    let header = ["Unix Time", ...Object.keys(this.workerReport)].join('\t') + '\n';
    this.appendToReportFile(header);
    setInterval(this.outputReportSummary.bind(this), options.reportInterval);
  },

  resetWorkerReport() {
    this.workerReport = {
      slicesStarted: 0,
      slicesCompleted: 0,
      slicesFailed: 0,
      sandboxesInitialized: 0,
      sandboxesTerminated: 0,
    };
  },

  outputReportSummary() {
    const summary = [Date.now(), ...Object.values(this.workerReport)].join('\t') + '\n';
    this.appendToReportFile(summary);
    this.resetWorkerReport();
  },

  appendToReportFile(contents) {
    fs.writeFileSync(this.options.reportFile, contents, {flag: 'a'});
  },

  onSandboxReady(sandbox) {
    const zeroes = '000';
    const shortId = (zeroes + sandbox.id.toString(16).toUpperCase()).slice(-zeroes.length);

    const sandboxData = {
      shortId,
    };

    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Initialized`);

    this.workerReport.sandboxesInitialized++;

    return sandboxData;
  },

  sandbox$onSliceStart(sandbox, sandboxData, slice) {
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Slice Started - "${sandbox.public.publicName}"`);

    this.workerReport.slicesStarted++;
  },

  sandbox$onSliceProgress(sandbox, sandboxData, ev) {
    // something
  },

  sandbox$onSliceError(sandbox, sandboxData, ev) {
    console.log('!!~~sliceError', ev);
    appendToReportFile(`sliceError: ${ev}\n`);
    this.workerReport.slicesFailed++;
  },

  sandbox$onError(sandbox, sandboxData, ev) {
    console.log('!!~~error', ev);
    appendToReportFile(`Error: ${ev}\n`);
    // this.workerReport.slicesFailed++;
  },
  
  sandbox$onSliceFinish(sandbox, sandboxData, ev) {
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Slice Completed - "${sandbox.public.publicName}"`);

    this.workerReport.slicesCompleted++;
  },
    
  sandbox$onWorkerStop(sandbox, sandboxData, ev) {
    const jobAddress = sandbox.jobAddress ? sandbox.jobAddress.substr(0, 10) : sandbox.jobAddress;
    console.log(` ~ [Sandbox 0x${sandboxData.shortId}] Terminated - Job address: ${jobAddress}`);

    this.workerReport.sandboxesTerminated++;
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

Object.assign(exports, reportLogger);
