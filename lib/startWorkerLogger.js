/**
 *  @file       startWorkerLogger.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 */

const process = require('process');
const os = require('os');
const util = require('util');
const inspect = Symbol.for('nodejs.util.inspect.custom');

/**
 * Detects and returns the appropriate logger for the environment
 * @param {object} options - cliArgs from worker
 * @returns {WorkerLogger}
 */
function getLogger({ outputMode='detect' })
{
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

    if (error.code === 'MODULE_NOT_FOUND')
      throw new Error(`Unknown outputMode "${outputMode}"`);
    throw error;
  }
}

/**
 * Start intercepting console.* methods so that log output from the worker goes to the appropriate log
 * target; eg syslog, file, windows event log, etc. Unlike the telnet console log interceptor which is
 * merely a passthrough shim, this is a "dead end" interceptor - we do not pass the log message through
  * to the original console method.  This implies, for example, that sending console messages to syslogd
 * quiesces the tty output.
 * 
 * @param {object} options - cliArgs from worker
 * @param {number} options.verbose
 * @param {boolean} options.outputMode - which logger to use (default='detect')
 */
exports.init = function startWorkerLogger$$init(options)
{
  const logger = getLogger(options);
  logger.init(options);

  /* The logger module's exports are its API. The following functions are supported, in this order
   * of severity:
   * . debug: debug-level message
   * . info:  informational message
   * . log:   normal, but significant, condition
   * . warn:  warning conditions
   * . error: error conditions
   *
   * Additionally, generic functions may be used when one of the above is not defined:
   * . at:    write a log message for a specific level; the level is the first argument
   * . raw:   same as at, but arguments are not formatted
   * . any:   write a log message without regard to log level
   *
   * All of these functions, with the exception of raw, receive only string arguments.
   */

  for (let level of ['debug', 'error', 'info', 'log', 'warn'])
  {
    if (logger[level])
      console[level] = (...args) => logger[level](          ...format(...args));
    else if (logger.at)
      console[level] = (...args) => logger.at(level,        ...format(...args));
    else if (logger.raw)
      console[level] = (...args) => logger.raw(level,       ...args);
    else if (logger.any)
      console[level] = (...args) => logger.any(`${level}:`, format(...args));
    else
      throw new Error('logger module missing export for ' + level);
  }

  require('./remote-console').reintercept();
}  

/**
 * Format console.log arguments for use by a non-native logger, eg syslog.  All non-string arguments are
 * converted into the best human-readable strings we can muster.
 */
function format(...argv)
{
  for (let i in argv)
  {
    try
    {
      if (typeof argv[i] === 'object' && argv[i] instanceof String)
        argv[i] = String(argv[i]);
      if (typeof argv[i] === 'object')
        argv[i] = util.inspect(argv[i]);        
      if (typeof argv[i] !== 'string')
        argv[i] = String(argv[i]);
    }
    catch(e)
    {
      if (e instanceof TypeError)
        argv[i] = '[encoding error: ' + e.message + ']';
    }
  }

  return argv;
}
