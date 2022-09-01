/**
 *  @file       worker-loggers/syslog.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module emits log lines to a remote syslogd, writing all
 *  console logs to it. Most worker events are passed through to be handled
 *  by the console logger.
 *
 *  @TODO: This could likely be improved by handling worker events directly
 *  and emitting events to the event log more deliberately than just
 *  redirecting the base console output. ~ER20220831
 */

require('./common-types');
const consoleLogger = require('./console');

const syslog = require('syslog-client');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);


const eventlogLogger = {
  /**
   *  Initialize the syslog worker logger
   *
   *  @param  {Worker} worker           DCP Worker object to log
   *  @param  {object} options          Options for logger behaviour (passed
   *    through to consoleLogger)
   */
  init(worker, options) {
    consoleLogger.init(worker, options);

    this.options = Object.assign({}, options);
    const syslogOptions = {
      transport: options.syslogTransport || 'udp', // tcp, udp, unix, tls
      port: options.syslogPort || 514,
    }

    this._syslog = syslog.createClient(options.syslogAddress || '127.0.0.1', options);
    this._processName = require('path').basename(process.mainModule.filename || process.argv0);

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
      error: syslog.Severity.Error,
      warn:  syslog.Severity.Warning,
      log:   syslog.Severity.Notice,
      info:  syslog.Severity.Informational,
      debug: syslog.Severity.Debug,
    }[level];

    this._syslog.log(strBuilder.join(' '), {
      severity,
    }, error => {
      if (error)
        _console.error('168: Unexpected error writing to syslog:', error);
    });
  }
};

for (const [prop, value] of Object.entries(consoleLogger))
{
  if (typeof value === 'function')
    exports[prop] = value.bind(consoleLogger);
}
Object.assign(exports, /*consoleLogger,*/ eventlogLogger);
