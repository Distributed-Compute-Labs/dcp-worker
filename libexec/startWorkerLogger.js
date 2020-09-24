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

  switch (outputMode) {
    case 'console':
      return require('./worker-loggers/console');
    case 'dashboard':
      return require('./worker-loggers/dashboard');
    default:
      throw new Error(`Unknown outputMode "${outputMode}"`);
  }
}

Object.assign(exports, {
  /**
   * This method will attach event listeners from the provided
   * worker to a worker logger. The logger to use is
   * determined by getLogger based on the environment.
   * 
   * @param {Worker} worker 
   * @param {object} options
   * @param {boolean} options.verbose
   * @param {boolean} options.outputMode - which logger to use (default='detect')
   */
  startWorkerLogger(worker, options={}) {
    const logger = getLogger(options);
    logger.init(worker, options);

    worker.on('payment', logger.onPayment.bind(logger));
    
    worker.on('fetchStart', logger.onFetchingSlices.bind(logger));
    worker.on('fetch', logger.onFetchedSlices.bind(logger));
    worker.on('fetchError', logger.onFetchSlicesFailed.bind(logger));

    worker.supervisor.on('sandboxReady', (sandbox) => {
      // logger.onSandboxStart can return a data object that will be
      // provided to the other sandbox event handlers
      const data = logger.onSandboxReady(sandbox) || {};
      sandbox.on('sliceStart', logger.sandbox$onSliceStart.bind(logger, sandbox, data));
      sandbox.on('sliceProgress', logger.sandbox$onSliceProgress.bind(logger, sandbox, data));
      sandbox.on('sliceFinish', logger.sandbox$onSliceFinish.bind(logger, sandbox, data));
      sandbox.on('workerStop', logger.sandbox$onWorkerStop.bind(logger, sandbox, data));
    });
  }
});
