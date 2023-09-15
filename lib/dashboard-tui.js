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
    defaultProgressBars: 0,
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

  function askPassword(promptMessage)
  {
    return new Promise((resolve, reject) => {
      passwordBox.focus();
      passwordBox.show();
      passwordBox.setLabel(promptMessage);

      function passwordSubmitFn(value)
      {
        passwordBox.hide();
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

  /** XXXpfr @todo Is this correct?  Or should we init progressData inside 'slice' like we used to.  */
  replaceSandboxEvent('ready', function dashboard$$job(sandbox, sandboxData, ev) {
    sandboxData.progressData = {
      indeterminate: true,
      progress: 0,
      label: sandbox?.public ? sandbox.public.name: '<no-label>',
    };
  });
  
  replaceSandboxEvent('slice', function dashboard$$slice(sandbox, sandboxData, ev) {
    sandboxPane.data.push(sandboxData.progressData);
    sandboxPane.update();
  });

  replaceSandboxEvent('progress', function dashboard$$progress(sandbox, sandboxData, ev) {
    if (!ev)
    {
      sandboxData.progressData.progress = 100;
      setTimeout(() => {
        if (sandboxData.progressData.indeterminate)
        {
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
  
  replaceSandboxEvent('sliceEnd', function dashboard$$sliceEnd(sandbox, sandboxData, ev) {
    sandboxPane.data = sandboxPane.data.filter(d => d != sandboxData.progressData);
    sandboxData.progressData.progress = 0;
    sandboxPane.update();
  });

  replaceSandboxEvent('end', function dashboard$$end(sandbox, sandboxData, ev) {
    sandboxPane.data = sandboxPane.data.filter(d => d != sandboxData.progressData);
    sandboxPane.deleteProgressBar();
    sandboxData.progressData.progress = 0;
    sandboxPane.update();
  });

  replaceWorkerEvent('beforeFetch', function dashboard$$beforeFetch(ev) {
    sliceFetchStatus = SLICE_FETCH_STATUS.FETCHING;
    updateWorkerInfo();
  });
  
  replaceWorkerEvent('fetch', function dashboard$$fetch(ev) {
    sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
    if (ev instanceof Error)
      console.error('Error fetching slices:', ev);
    else if ( !(utils.slicesFetched(ev) === 0 && sandboxPane.data.length === 0))
      sliceFetchStatus = SLICE_FETCH_STATUS.WORKING;
    updateWorkerInfo();
  });

  worker.on('end', () =>  { screen.destroy(); });

  worker.on('sandbox', function dashboard$$sandbox(ev) {
    sandboxPane.createProgressBar();
    sandboxPane.update();
  });

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
