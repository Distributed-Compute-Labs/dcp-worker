/**
 *  @file       worker-loggers/dashboard.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 *  @author     Wes Garland, wes@distributive.network
 *  @date       June 2023
 *
 *  This module uses the blessed library to create a monitoring dashboard for the worker.
 *  A corresponding worker-logger, dashboard.js, knows how to log to this dashboard.
 */
'use strict';

const dcpConfig  = require('dcp/dcp-config');
const chalk      = require('chalk');
const blessed    = require('blessed');
const contrib    = require('blessed-contrib');
const components = require('./blessed-components');
const utils      = require('../lib/utils');

const { replaceWorkerEventHandler, replaceSandboxEventHandler, newSandboxCallbacks }  = require('./default-ui-events');

const SLICE_FETCH_STATUS = {
  IDLE: chalk.yellow('Idle'),
  FETCHING: chalk.blue('Fetching Work...'),
  WORKING: chalk.green('Working'),
  NO_WORK: chalk.red('No Work Available'),
};

const usingDebugger = require('module')._cache.niim instanceof require('module').Module;
const screenConf = {
  input:  usingDebugger ? new (require('events').EventEmitter) : undefined,
  output: usingDebugger ? new (require('events').EventEmitter) : undefined,
};
/**
 *  Initialize the blessed dashboard
 *  @param  {Worker}    worker    Reference to the DCP Worker
 *  @param {object} options Options which may affect behaviour. Not currently used.
 */
exports.init = function dashboard$$init(worker, options)
{
  var sliceFetchStatus = SLICE_FETCH_STATUS.IDLE;
  var totalDCCs = 0;
  var screen = blessed.screen(screenConf);

  worker.on('end', () =>  {
    screen.destroy();
    screen = false;
  });
  process.on('exit', () => {
    if (screen)
      screen.destroy();
  });

  const grid = new contrib.grid({ rows: 3, cols: 5, screen }); // eslint-disable-line new-cap
  const workerInfoPane = grid.set(2, 0, 1, 5, components.log, {
    label: 'Worker Status',
    scrollbar: { bg: 'blue' },
  });
  const logPane = grid.set(0, 2, 2, 3, components.log, {
    label: 'Worker Log',
    scrollbar: { bg: 'blue' },
  });
  global.lp = logPane;
  const sandboxPane = grid.set(0, 0, 2, 2, components.sandboxPaneFactory, {
    label: 'Sandboxes',
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      bg: 'blue',
    },
  });
  const passwordBox = blessed.textbox({
    parent: screen,
    border: 'line',
    top: 'center',
    left: 'center',
    width: '50%',
    height: 'shrink',
    padding: {
      top: 1
    },
    censor: true,
    inputOnFocus: true,
    label: 'Password Prompt:',
    hidden: true,
  });

  global.tui = { workerInfoPane, logPane, sandboxPane, screen, grid, passwordBox };
  let lastTask;

  function askPassword(promptMessage)
  {
    return new Promise((resolve, reject) => {
      passwordBox.focus();
      passwordBox.show();
      passwordBox.setLabel(promptMessage);

      function passwordSubmitFn(value)
      {
        passwordBox.hide();
        screen.render();
        passwordBox.removeListener('submit', passwordSubmitFn);
        passwordBox.setValue('');
        resolve(value);
      }

      passwordBox.on('submit', passwordSubmitFn);
      screen.render();
    });
  }

  // override wallet.passphrasePrompt with password box
  require('dcp/wallet').passphrasePrompt = (promptMessage) => {
    return askPassword(promptMessage);
  };

  delete exports.init; /* singleton */

  if (!usingDebugger)
    exports.logPane = logPane; /* now dashboard log can find the pane */
  setInterval(() => screen.render(), 2000).unref(); /* ensure we didn't forget to render an important update */
  updateWorkerInfo();

  /* Apply key bindings which mimic canonical input mode */
  screen.key(['C-c'], ()    => raise('SIGINT'));
  screen.key(['C-z'], ()    => raise('SIGTSTP'));
  screen.key(['\u001c'], () => raise('SIGQUIT')); /* C-\ */
  screen.key(['escape'], () => raise('SIGINT'));

  setInterval(updateWorkerInfo, 1000).unref();
  function updateWorkerInfo(fetchInfo)
  {
    var gpuInfo = '';
    const workerOptions = worker.workerOptions;
    if (fetchInfo)
      lastTask = fetchInfo;

    if (typeof systemStateInfo.gpu === 'undefined')
      gpuInfo = 'not detected';
    else if (systemStateInfo.gpu.disabled)
      gpuInfo = chalk.red('disabled') + chalk.grey(` (${systemStateInfo.gpu.device})`);
    else
      gpuInfo = chalk.cyan(systemStateInfo.gpu.device);

    workerInfoPane.setLabel(`Worker Status [${sliceFetchStatus}]`);
    workerInfoPane.setContent([
      chalk.green(` DCCs Earned: ${chalk.bold(totalDCCs.toFixed(3))} ⊇`),
      '',
      `           Scheduler: ${chalk.yellow(dcpConfig.scheduler.location.href)}`,
      `                Bank: ${chalk.yellow(dcpConfig.bank.location.href)}`,
      `        Bank Account: ${chalk.yellow(worker.paymentAddress || 'Starting...')}`,
      `            Identity: ${chalk.yellow(worker.identityKeystore? worker.identityKeystore.address : 'Starting...')}`,
      `                 GPU: ${gpuInfo}`,
      `                Jobs: ${workerOptions.jobAddresses?.length ? workerOptions.jobAddresses.join(', ') : '<any>'}`,
      `      Compute Groups: ${Object.keys(workerOptions.computeGroups).length + (workerOptions.leavePublicGroup ? 0 : 1)}`,
      `Global Compute Group: ${workerOptions.leavePublicGroup ? 'no' : 'yes'}`,
      `           Worker Id: ${worker.workerId}`,
      `        Current Time: ${new Date(Date.now()).toUTCString()}`,
      `   Last Task Request: ${lastTask ? new Date(lastTask.fetchStart).toUTCString() : 0}`,
      `      Slices in task: ${lastTask ? Object.values(lastTask.slices).reduce((acc, val) => acc + val, 0) : 0}`,
      `        Jobs in task: ${lastTask ? Object.keys(lastTask.jobs).length : 0}`,
    ].join('\n'));
    screen.render();
  }

  /* Override default event behaviour to work better with the Dashboard. */
  replaceSandboxEventHandler('ready', function dashboard$$sandboxReady(sandbox, sandboxData) {
    if (!sandboxData.label)
      sandboxData.label = '<ready>';
    sandboxData.slice.number = 0;
    sandboxPane.update();
  });

  replaceSandboxEventHandler('job', function dashboard$$sandboxJob(sandbox, sandboxData, job) {
    sandboxData.job = job;
    sandboxData.label = job.name ? `${job.name} ${job.address.slice(0,8)}` : `<job ${job.address}>`;
    if (job.description)
      sandboxData.label += ': ' + job.description;
    sandboxPane.update();
  });

  replaceSandboxEventHandler('slice', function dashboard$$slice(sandbox, sandboxData, sliceNumber) {
    sandboxData.slice.number = sliceNumber;
  });

  replaceSandboxEventHandler('progress', function dashboard$$progress(sandbox, sandboxData, progress) {
    sandboxData.slice.progress = progress;
  });

  replaceSandboxEventHandler('sliceEnd', function dashboard$$sliceEnd(sandbox, sandboxData, sliceNumber) {
    sandboxData.slice.progress = 100;
  });

  replaceSandboxEventHandler('end', function dashboard$$end(sandbox, sandboxData) {
    sandboxPane.deleteSandboxRow(sandboxData.sandboxRow);
    sandboxPane.update();
  });

  replaceWorkerEventHandler('beforeFetch', function dashboard$$beforeFetch(ev) {
    sliceFetchStatus = SLICE_FETCH_STATUS.FETCHING;
    updateWorkerInfo();
  });

  replaceWorkerEventHandler('fetch', function dashboard$$fetch(ev) {
    sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
    if (ev instanceof Error)
      console.error('Error fetching slices:', ev);
    else if ( !(utils.slicesFetched(ev) === 0 && sandboxPane.data.length === 0))
      sliceFetchStatus = SLICE_FETCH_STATUS.WORKING;
    updateWorkerInfo(ev);
  });

  /* Sandbox Data
   * label - text that describes the sandbox
   * slice - defined on first slice
   *   .number - holds current slice
   *   .progress - last progress update for this slice, 0 on new slice if last slice had numeric progress
   * sandboxRow - TUI element from lib/blessed-components/sandboxes.js
   *   .text - text element
   *   .progressBar - progress bar element
   *   .sandboxData - this sandbox data object
   */
  function initSandboxData(_worker, sandbox, sandboxData)
  {
    sandboxData.seq = initSandboxData.seq = (initSandboxData.seq || 0) + 1;
    sandboxData.slice = {};
    sandboxData.sandboxRow = sandboxPane.createSandboxRow(sandboxData);

    /* Updating an autoUpdate property cases that change to be immediately reflected in the
     * data that blessed uses to draw the TUI dashboard. We build this object after initializing
     * the sandbox row to keep race conditions at bay.
     */
    function autoUpdate(prop)
    {
      Object.defineProperty(autoUpdate.object, prop, {
        get: () => autoUpdate.storage[prop],
        set: (value) => {
          autoUpdate.storage[prop] = value;
          sandboxData.sandboxRow.update();
        },
        enumerable: true,
      });
    }

    autoUpdate.storage = sandboxData.slice;
    sandboxData.slice = autoUpdate.object = {};
    autoUpdate('progress');
    autoUpdate('number');
    sandboxData.sandboxRow.update();
  }
  newSandboxCallbacks.push(initSandboxData);

  worker.on('job', job => console.log(`new job: ${job.name} ${job.address.slice(0,8)} ${job.description || ''} ${job.link || ''}`));
  worker.on('payment', function dashboard$$payment(ev) {
    const payment = parseFloat(ev);

    if (!isNaN(payment))
      totalDCCs += payment;

    sandboxPane.update();
    updateWorkerInfo();
  });
};

/**
 * Send a signal to the caller
 * @param {number|string} sig    the signal to raise
 */
function raise(sig)
{
  process.kill(process.pid, sig);
}
