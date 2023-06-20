/**
 *  @file       worker-loggers/syslog.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module emits log lines to a remote syslogd, writing all
 *  console logs to it.
 */
'use strict';

const os     = require('os');
const syslog = require('syslog-client');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);

/**
 *  Initialize the syslog worker logger
 *
 *  @param  {object} cliArgs          Options for logger behaviour (passed
 *                                    through to consoleLogger)
 */
exports.init = function syslog$$init(cliArgs)
{
  {
    const syslogOptions = {
      syslogHostname: os.hostname(),
      transport: cliArgs.syslogTransport || 'udp', // tcp, udp, unix, tls
      port:      cliArgs.syslogPort,
      facility: syslog.Facility[cliArgs.syslogFacility[0].toUpperCase() + cliArgs.syslogFacility.slice(1)],
    }

    exports.syslogClient = syslog.createClient(cliArgs.syslogAddress || '127.0.0.1', syslogOptions);
    exports.processName = require('path').basename(process.mainModule.filename || process.argv0);
  }
}

function log(level, ...items)
{
  {
    const logPrefix = [`${exports.processName}[${process.pid}]:`];
    const logElements = logPrefix.concat(items);
    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: syslog.Severity.Error,
      warn:  syslog.Severity.Warning,
      log:   syslog.Severity.Notice,
      info:  syslog.Severity.Informational,
      debug: syslog.Severity.Debug,
    }[level];

    exports.syslogClient.log(logElements.join(' '), {
      severity,
    }, error => {
      if (error)
        _console.error('168: Unexpected error writing to syslog:', error);
    });
  }
}

exports.at = log;
