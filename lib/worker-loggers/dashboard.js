/**
 *  @file       worker-loggers/dashboard.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This worker logger uses the blessed library to create
 *  a monitoring dashboard for the worker.
 */

const dcpConfig = require('dcp/dcp-config');
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const util = require('util');

const components = require('../blessed-components');
require('./common-types');

const SLICE_FETCH_STATUS = {
  IDLE: chalk.yellow('Idle'),
  FETCHING: chalk.blue('Fetching Work...'),
  WORKING: chalk.green('Working'),
  NO_WORK: chalk.red('No Work Available'),
}

/** @type {WorkerLogger} */
const dashboardLogger = {
  init(worker, options) {
    this.worker = worker;
    this.options = options;
    this.supervisor = worker.supervisor;
    this.totalDCCs = 0;
    this.sliceFetchStatus = SLICE_FETCH_STATUS.IDLE;
    exports.screen = this.screen = blessed.screen();
    const grid = new contrib.grid({rows: 3, cols: 5, screen: this.screen});

    const log = grid.set(0, 2, 2, 3, components.log, {
      label: 'Worker Log',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      scrollbar: {
        bg: 'blue',
      },
    });

    console.log = console.error = console.warn = console.info = console.debug = function logWrapper() {
      arguments = Array.from(arguments);
      for (let i in arguments)
      {
        if (arguments[i] instanceof Error)
          arguments[i] = util.inspect(arguments[i]);
      }
      log.log.apply(log, arguments);
    }
    require('../remote-console').reintercept();

    this.sandboxes = grid.set(0, 0, 2, 2, components.sandboxes, {
      label: 'Sandboxes',
      defaultProgressBars: this.supervisor.maxWorkingSandboxes,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      scrollbar: {
        bg: 'blue',
      },
    });

    this.workerInfo = grid.set(2, 0, 1, 5, blessed.text);
    this.updateWorkerInfo();

    setInterval(() => this.screen.render(), 1000).unref();

    function raise(sig)
    {
      process.kill(process.pid, sig);
    }

    /* Apply key bindings which mimic canonical input mode */
    this.screen.key(['C-c'], () => raise('SIGINT'));
    this.screen.key(['C-z'], () => raise('SIGTSTP'));
    this.screen.key(['C-\\'], () => raise('SIGQUIT'));

    this.screen.key(['escape'], () => {
      console.log('Stopping worker...');
      worker.stop();
    });

    this.passwordBox = blessed.textbox({
      parent: this.screen,
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

    // override wallet.passphrasePrompt with password box
    options.wallet.passphrasePrompt = (promptMessage) => {
      return this.askPassword(promptMessage);
    };

    this.screen.append(this.passwordBox);
  },

  askPassword(promptMessage) {
    return new Promise((resolve, reject) => {
      passwordBox = this.passwordBox;
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

      this.passwordBox.on('submit', passwordSubmitFn);
      this.screen.render();
    });
  },

  updateWorkerInfo() {
    const workerOptions = dcpConfig.worker;
    
    this.workerInfo.setLabel(`Worker Status [${this.sliceFetchStatus}]`);
    this.workerInfo.setContent([
      chalk.green(` DCCs Earned: ${chalk.bold(this.totalDCCs.toFixed(7))}`),
      '',
      `   Scheduler: ${chalk.yellow(dcpConfig.scheduler.location.href)}`,
      `        Bank: ${chalk.yellow(dcpConfig.bank.location.href)}`,
      `Bank Account: ${chalk.yellow(this.supervisor.paymentAddress || 'Starting...')}`,
      `    Identity: ${chalk.yellow(this.supervisor.identityKeystore? this.supervisor.identityKeystore.address : 'Starting...')}`,
      `        Jobs: ${workerOptions.jobAddresses?.length ? workerOptions.jobAddresses.join(', ') : '<any>'}`,
      ` Priv Groups: ${Object.keys(workerOptions.computeGroups).length}`,
      `   Pub Group: ${workerOptions.leavePublicGroup ? 'no' : 'yes'}`,
    ].join('\n'));
  },

  onSandboxReady(sandbox) {
    
  },

  sandbox$onSliceStart(sandbox, sandboxData, slice) {
    sandboxData.progressData = {
      indeterminate: true,
      progress: 0,
      label: sandbox.public.name,
    };

    this.sandboxes.data.push(sandboxData.progressData);

    this.sandboxes.update();
  },

  sandbox$onSliceProgress(sandbox, sandboxData, ev) {
    if (ev.indeterminate) {
      sandboxData.progressData.progress = 100;

      setTimeout(() => {
        if (sandboxData.progressData.indeterminate) {
          sandboxData.progressData.progress = 0;
          this.sandboxes.update();
        }
      }, 500).unref();
    } else {
      sandboxData.progressData.progress = ev.progress;
      sandboxData.progressData.indeterminate = false;
    }

    this.sandboxes.update();
  },
  
  sandbox$onSliceFinish(sandbox, sandboxData, ev) {
    this.sandboxes.data =
      this.sandboxes.data.filter(d => d != sandboxData.progressData);

    this.sandboxes.update();
  },
    
  sandbox$onWorkerStop(sandbox, sandboxData, ev) {
    this.sandbox$onSliceFinish(sandbox, sandboxData, ev);
  },

  onPayment({ payment }) {
    try {
      payment = parseFloat(payment);
    } catch (e) {
      console.error("Failed to parse payment float:", payment);
      return;
    }

    try {
      this.totalDCCs += payment;
      this.updateWorkerInfo();
    } catch(e) {
      console.error(e.message);
    }
  },

  onFetchingSlices() {
    this.sliceFetchStatus = SLICE_FETCH_STATUS.FETCHING;
    this.updateWorkerInfo();
  },

  onFetchedSlices(fetchedSliceCount) {
    if (fetchedSliceCount === 0 && this.sandboxes.data.length === 0) {
      this.sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
    } else {
      this.sliceFetchStatus = SLICE_FETCH_STATUS.WORKING;
    }

    this.updateWorkerInfo();
  },

  onFetchSlicesFailed(ev) {
    this.sliceFetchStatus = SLICE_FETCH_STATUS.NO_WORK;
    this.updateWorkerInfo();
  },
};

Object.assign(exports, dashboardLogger);
