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

const { replaceWorkerEvent, replaceSandboxEvent }  = require('./default-ui-events');

const SLICE_FETCH_STATUS = {
  IDLE: chalk.yellow('Idle'),
  FETCHING: chalk.blue('Fetching Work...'),
  WORKING: chalk.green('Working'),
  NO_WORK: chalk.red('No Work Available'),
}

const usingDebugger = require('module')._cache.niim instanceof require('module').Module;
const screenConf = {
  input:  usingDebugger ? new (require('events').EventEmitter) : undefined,
  output: usingDebugger ? new (require('events').EventEmitter) : undefined,
};
/** 
 */
exports.init = function dashboard$$init(worker, options)
{
  var sliceFetchStatus = SLICE_FETCH_STATUS.IDLE;
  var totalDCCs = 0;
  const screen = blessed.screen(screenConf);
  const grid = new contrib.grid({rows: 3, cols: 5, screen});
  const workerInfoPane = grid.set(2, 0, 1, 5, blessed.text);
  
  const logPane = grid.set(0, 2, 2, 3, components.log, {
    label: 'Worker Log',
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      bg: 'blue',
    },
  });

  const sandboxPane = grid.set(0, 0, 2, 2, components.sandboxes, {
    label: 'Sandboxes',
    defaultProgressBars: Math.floor(worker.workerOptions.cores.cpu) || 1,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    scrollbar: {
      bg: 'blue',
    },
  });

  delete exports.init; /* singleton */

  if (!usingDebugger)
    exports.logPane = logPane; /* now dashboard log can find the pane */
  setInterval(() => screen.render(), 50).unref(); /* 50ms = 20 fps */
  updateWorkerInfo();
  screen.render();
  
  /* Apply key bindings which mimic canonical input mode */
  screen.key(['C-c'], ()    => raise('SIGINT'));
  screen.key(['C-z'], ()    => raise('SIGTSTP'));
  screen.key(['\u001c'], () => raise('SIGQUIT')); /* C-\ */
  
  screen.key(['escape'], () => {
    console.log('Stopping worker...');
    worker.stop();
  });

  function updateWorkerInfo()
  {
    const workerOptions = worker.workerOptions;
    
    workerInfoPane.setLabel(`Worker Status [${sliceFetchStatus}]`);
    workerInfoPane.setContent([
      chalk.green(` DCCs Earned: ${chalk.bold(totalDCCs.toFixed(3))}`),
      '',
      `   Scheduler: ${chalk.yellow(dcpConfig.scheduler.location.href)}`,
      `        Bank: ${chalk.yellow(dcpConfig.bank.location.href)}`,
      `Bank Account: ${chalk.yellow(worker.paymentAddress || 'Starting...')}`,
      `    Identity: ${chalk.yellow(worker.identityKeystore? worker.identityKeystore.address : 'Starting...')}`,
      `        Jobs: ${workerOptions.jobAddresses?.length ? workerOptions.jobAddresses.join(', ') : '<any>'}`,
      ` Priv Groups: ${Object.keys(workerOptions.computeGroups).length}`,
      `   Pub Group: ${workerOptions.leavePublicGroup ? 'no' : 'yes'}`,
    ].join('\n'));
  }

  /* Override default event behaviour to work better with the Dashboard. */

  replaceSandboxEvent('slice', function dashboard$$sliceStart(sandbox, sandboxData, ev) {
    sandboxData.progressData = {
      indeterminate: true,
      progress: 0,
      label: sandbox.public.name,
    };

    sandboxPane.data.push(sandboxData.progressData);
    sandboxPane.update();
  });

  replaceSandboxEvent('progress', function dashboard$$progress(sandbox, sandboxData, ev) {
    if (!ev)
    {
      sandboxData.progressData.progress = 100;
      setTimeout(() => {
        if (sandboxData.progressData.indeterminate) {
          sandboxData.progressData.progress = 0;
          sandboxPane.update();
        }
      }, 500).unref();
    }
    else
    {
      sandboxData.progressData.progress = ev;
      sandboxData.progressData.indeterminate = false;
    }

    sandboxPane.update();
  });
  
  replaceSandboxEvent('sliceEnd', function dashboard$$sliceEnd(sandbox,sandboxData, ev) {
    sandboxPane.data = sandboxPane.data.filter(d => d != sandbox.sliceProgress);
    sandboxPane.update();
  });

  worker.on('payment', function dashboard$$paymentHandler(ev) {
    const payment = parseFloat(ev);
    
    if (!isNaN(payment))
      totalDCCs += payment;

    sandboxPane.update();
    updateWorkerInfo();
  });


  worker.on('beforeFetch', function dashboard$$beforeFetch(ev) {
    sliceFetchStatus = SLICE_FETCH_STATUS.FETCHING;
    updateWorkerInfo();
  });
  
  replaceWorkerEvent('fetch', function dashboard$$fetch(ev) {
    var slicesFetched;

    if (ev instanceof Error)
    {
      console.error('Error fetching slices:', ev);
      sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
      updateWorkerInfo();
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

    if (slicesFetched === 0 && sandboxPane.data.length === 0) {
      sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
    } else {
      sliceFetchStatus = SLICE_FETCH_STATUS.WORKING;
    }

    updateWorkerInfo();
  });

  worker.on('end', () =>  { screen.destroy(); });

};

/**
 * Send a signal to the caller
 * @param {number|string} sig    the signal to raise
 */
function raise(sig)
{
  process.kill(process.pid, sig);
}
