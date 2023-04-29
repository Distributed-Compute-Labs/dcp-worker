/**
 *  @file       worker-loggers/event-log.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module emits events to the Windows event-log, writing all
 *  console logs to it. Most worker events are passed through to be handled
 *  by the console logger.
 *
 *  @TODO: This could likely be improved by handling worker events directly
 *  and emitting events to the event log more deliberately than just
 *  redirecting the base console output. ~ER20220831
 */

require('./common-types');
const consoleLogger = require('./console');

const { EventLog } = require('node-eventlog');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);


const eventlogLogger = {
  /**
   *  Initialize the eventlog worker logger
   *
   *  @param  {Worker} worker           DCP Worker object to log
   *  @param  {object} options          Options for logger behaviour (passed
   *    through to consoleLogger)
   */
  init(worker, options) {
    consoleLogger.init(worker, options);

    this._processName = require('path').basename(process.mainModule.filename || process.argv0);
    const source = options.source || this._processName || 'dcp-worker';
    // _console.log(`036: creating new EventLog(${source}) client...`);
    this._eventLog = new EventLog(source);

    ['debug','error','info','log','warn'].forEach(level => {
      console[level] = (...args) => this._log(level, ...args);
    });
  },

  _log(level, ...items) {
    const strBuilder = [`${this._processName}[${process.pid}]:`];
    
    items.forEach(i => {
      try {
        switch (typeof i) {
          case 'object':
            strBuilder.push(JSON.stringify(i));
            break;
          default:
            strBuilder.push(String(i));
        }
      }
      catch (e) {
        if (e instanceof TypeError) {
          strBuilder.push('[encoding error: ' + e.message + ']');
        }
      }
    });
    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: 'error',
      warn:  'warn',
      log:   'info',
      info:  'info',
      debug: 'info',
    }[level];

    // _console.debug(`074: about to actually log a line:`, strBuilder, severity);
    return this._eventLog.log(strBuilder.join(' '), severity).catch(error => {
      if (error)
        _console.error('255: Unexpected error writing to event log:', error);
    });
  }
};

// necessary to keep `this` pointing at the correct thing when we call 
for (const [prop, value] of Object.entries(consoleLogger))
{
  if (typeof value === 'function')
    exports[prop] = value.bind(consoleLogger);
}
Object.assign(exports, eventlogLogger);
