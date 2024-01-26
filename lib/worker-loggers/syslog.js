/**
 *  @file       worker-loggers/syslog.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module emits log lines to a remote syslogd, writing all
 *  console logs to it.
 */
'use strict';

const os      = require('os');
const syslog  = require('syslog-client');
const process = require('process');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);
var syslogClient;
var processName;

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

    syslogClient = syslog.createClient(cliArgs.syslogAddress || '127.0.0.1', syslogOptions);
    processName = require('path').basename(process.mainModule.filename || process.argv0);
    exports.close = () => syslogClient.close();
  }
}

function log(level, ...argv)
{
  {
    const logPrefix = `${processName}[${process.pid}]: `;
    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: syslog.Severity.Error,
      warn:  syslog.Severity.Warning,
      log:   syslog.Severity.Notice,
      info:  syslog.Severity.Informational,
      debug: syslog.Severity.Debug,
    }[level];

    const logMessages = argv.join(' ').split('\n');

    for (let logMessage of logMessages)
    {
      logMessage = logPrefix + logMessage;
      syslogClient.log(logMessage, { severity }, error => {
        if (error)
          _console.error('168: Unexpected error writing to syslog:', error);
      });
    }
  }
}

exports.at = log;
