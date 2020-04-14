/**
 *  @file       startSupervisorLogger.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 */

const process = require('process');
require('./supervisor-loggers/common-types');

/**
 * Detects and returns the appropriate logger for the environment
 * @returns {SupervisorLogger}
 */
function getLogger({ outputMode='detect' }) {
  if (outputMode === 'detect') {
    if (process.stdout.isTTY && process.env.LANG.match(/UTF-?8/i)) {
      outputMode = 'dashboard';
    } else {
      outputMode = 'console';
    }
  }

  switch (outputMode) {
    case 'console':
      return require('./supervisor-loggers/console');
    case 'dashboard':
      return require('./supervisor-loggers/dashboard');
    default:
      throw new Error(`Unknown outputMode "${outputMode}"`);
  }
}

Object.assign(exports, {
  /**
   * This method will attach event listeners from the provided
   * supervisor to a supervisor logger. The logger to use is
   * determined by getLogger based on the environment.
   * 
   * @param {Supervisor} supervisor 
   * @param {object} options
   * @param {boolean} options.verbose
   * @param {boolean} options.outputMode - which logger to use (default='detect')
   */
  startSupervisorLogger(supervisor, options={}) {
    const logger = getLogger(options);
    logger.init(supervisor, options);

    supervisor.on('dccCredit', logger.onDccCredit.bind(logger));
    
    supervisor.on('fetchingSlices', logger.onFetchingSlices.bind(logger));
    supervisor.on('fetchedSlices', logger.onFetchedSlices.bind(logger));
    supervisor.on('fetchSlicesFailed', logger.onFetchSlicesFailed.bind(logger));

    supervisor.on('sandboxStart', (sandbox) => {
      // logger.onSandboxStart can return a data object that will be
      // provided to the other sandbox event handlers
      const data = logger.onSandboxStart(sandbox) || {};
      sandbox.on('sliceStart', logger.sandbox$onSliceStart.bind(logger, sandbox, data));
      sandbox.on('sliceProgress', logger.sandbox$onSliceProgress.bind(logger, sandbox, data));
      sandbox.on('sliceFinish', logger.sandbox$onSliceFinish.bind(logger, sandbox, data));
      sandbox.on('workerStop', logger.sandbox$onWorkerStop.bind(logger, sandbox, data));
    });
  }
});
