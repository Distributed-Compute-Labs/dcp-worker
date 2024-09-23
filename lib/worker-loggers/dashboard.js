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

/**
 *  Initialize the Blessed dashboard
 *
 *  @param  {object} options Options affecting dasboard behaviour
 */
exports.init = function dashboardLogger$$init(options)
{
  const dashboardTui = require('../dashboard-tui');
  const inspect = Symbol.for('nodejs.util.inspect.custom');

  function logWrapperFactory(logLevel)
  {
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
          argv[i] = require('node:util').inspect(argv[i]);
        else if (logLevel === 'error' && typeof argv[i] === 'string')
          argv[i] = chalk.red(argv[i]);
      }
      dashboardTui.logPane.log(...argv);
    }
  }

  for (let level of ['log', 'warn', 'debug', 'info', 'error'])
    exports[level] = logWrapperFactory(level);

  var i = 0;
  var throbArgsCache = false;
  const throbChars = '/-\\|';
  /**
   * throb API: calls with arguments set facility and message.  First call without argument emits the
   *            message. All calls without arguments advance the throbber.
   */
  exports.throb = function throb(throbFacility, ...args) {
    if (throbFacility)
    {
      throbArgsCache = { throbFacility, args };
      return;
    }

    if (throbArgsCache)
    {
      exports[throbArgsCache.throbFacility](...throbArgsCache.args);
      throbArgsCache = false;
    }

    i = (i + 1) % throbChars.length;
    dashboardTui.logPane.advanceThrob(throbChars[i]);
  }
}
