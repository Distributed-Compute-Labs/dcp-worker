/**
 *  @file       startWorkerLogger.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 */

const process = require('process');
const os = require('os');
require('./worker-loggers/common-types');

/**
 * Detects and returns the appropriate logger for the environment
 * @returns {WorkerLogger}
 */
function getLogger({ outputMode='detect' }) {
  if (outputMode === 'detect') {
    if (process.stdout.isTTY && os.platform() !== 'win32' &&
        process.env.LANG && process.env.LANG.match(/utf-?8/i)) {
      outputMode = 'dashboard';
    } else {
      outputMode = 'console';
    }
  }

  try
  {
    const om = require('path').basename(outputMode);
    return require('./worker-loggers/' + om);
  }
  catch (error)
  {
    console.error(`032: Failed to load worker logger "${outputMode}":`, error);
    throw new Error(`Unknown outputMode "${outputMode}"`);
  }
}

const workerEvents = {
  fetchStart:     'onFetchingSlices',
  fetchEnd:       'onFetchedSlices',
  fetchError:     'onFetchSlicesFailed',
  submit:         'onSubmit',
  submitError:    'onSubmitError',
  payment:        'onPayment',
  error:          'onError',
  warning:        'onWarning',
}
const supervisorEvents = {
  submittingResult: 'onSubmitStart',
}
const sandboxEvents = {
  start:          'sandbox$onSliceStart',
  sliceProgress:  'sandbox$onSliceProgress',
  sliceFinish:    'sandbox$onSliceFinish',
  terminated:     'sandbox$onWorkerStop',
}

Object.assign(exports, {
  /**
   * This method will attach event listeners from the provided
   * worker to a worker logger. The logger to use is
   * determined by getLogger based on the environment.
   * 
   * @param {Worker} worker 
   * @param {object} options
   * @param {number} options.verbose
   * @param {boolean} options.outputMode - which logger to use (default='detect')
   */
  startWorkerLogger(worker, options={}) {
    const logger = getLogger(options);
    logger.init(worker, options);

    for (const [ev, handler] of Object.entries(workerEvents))
    {
      if (typeof logger[handler] === 'function')
        worker.on(ev, logger[handler].bind(logger));
    }
    for (const [ev, handler] of Object.entries(supervisorEvents))
    {
      if (typeof logger[handler] === 'function')
        worker.supervisor.on(ev, logger[handler].bind(logger));
    }

    worker.on('sandbox', (sandbox) => {
      /**
       * logger.onSandboxStart can return a data object that will be provided to
       * the other sandbox event handlers
       */
      const data = logger.onSandboxReady(sandbox) || {};
      for (const [ev, handler] of Object.entries(sandboxEvents))
      {
        if (typeof logger[handler] === 'function')
          sandbox.on(ev, logger[handler].bind(logger, sandbox, data));
      }
    });
  }
});
