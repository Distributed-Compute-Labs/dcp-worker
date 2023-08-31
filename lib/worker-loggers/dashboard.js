/**
 *  @file       worker-loggers/dashboard.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This worker logger uses the blessed library to create
 *  a monitoring dashboard for the worker.
 */
'use strict';

const chalk = require('chalk');
const _console = new (require('console').Console)(process);

exports.init = function dashboardLogger$$init(options)
{
  function logWrapperFactory(logLevel)
  {
    const inspect = Symbol.for('nodejs.util.inspect.custom');
    const dashboardTui = require('../dashboard-tui');
    
    return function wrappedLogFun() {
      if (!dashboardTui.logPane) /* no logPane => TUI not ready - fallback to console */
      {
        const consoleLogger = require('./console');
        if (consoleLogger.init)
          consoleLogger.init();

        const logAt = consoleLogger.at || consoleLogger.raw;
        logAt(logLevel, ...arguments);
        return;
      }
      
      const argv = Array.from(arguments);
      for (let i in argv)
      {
        if (argv[i] instanceof Error || (typeof argv[i] === 'object' && argv[i][inspect]))
          argv[i] = util.inspect(argv[i]);
        else if (logLevel === 'error' && typeof argv[i] === 'string')
          argv[i] = chalk.red(argv[i]);
      }
      dashboardTui.logPane.log(...argv);
    }
  }

  for (let level of ['log', 'warn', 'debug', 'info', 'error'])
    exports[level] = logWrapperFactory(level);
}

