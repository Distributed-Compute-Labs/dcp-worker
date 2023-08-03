/**
 *  @file       worker-loggers/event-log.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module redirects logs to the Windows event-log, writing all
 *  console logs to it. 
 */
'use strict';

const os = require('os');
if (os.platform() !== 'win32')
  throw new Error(`Windows Event Log module is not supported on ${os.platform()}`);

const { EventLog } = require('node-eventlog');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);

/**
 *  Initialize the eventlog worker logger
 *
 *  @param  {object} options          Options for logger behaviour (passed
 *    through to consoleLogger)
 */
exports.init = function eventLog$$init(options)
{
  exports._processName = require('path').basename(process.mainModule.filename || process.argv0);
  const source = options.source || exports._processName || 'dcp-worker';
  exports._eventLog = new EventLog(source);
  require('../startWorkerLogger').inspectOptions.colors = false;
  exports.at = log;
}

/**
 * @param {string}    level    The node log level to log at
 * @param {[string]}  items    An array of strings to log as a single message
 */
function log(level, ...items)
{
  {    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: 'error',
      warn:  'warn',
      log:   'info',
      info:  'info',
      debug: 'info',
    }[level];

    return exports._eventLog.log(items.join(' '), severity).catch(error => {
      if (error)
        _console.error('255: Unexpected error writing to event log:', error);
    });
  }
}
