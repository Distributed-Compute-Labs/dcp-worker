/**
 *  @file       worker-loggers/dashboard.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This worker logger uses the blessed library to create
 *  a monitoring dashboard for the worker.
 */

const chalk = require('chalk');
const _console = new (require('console').Console)(process);

exports.init = function dashboardLogger$$init(options)
{
  function logWrapperFactory(logLevel)
  {
    const inspect = Symbol.for('nodejs.util.inspect.custom');
    const dashboardTui = require('../dashboard-tui');
    
    return function wrappedLogFun() {
      if (!dashboardTui.logPane) /* no logPane => TUI not ready - fallback to underlying */
        return _console[logLevel].apply(this, arguments);
      
      arguments = Array.from(arguments);
      for (let i in arguments)
      {
        if (arguments[i] instanceof Error || (typeof arguments[i] === 'object' && arguments[i][inspect]))
          arguments[i] = util.inspect(arguments[i]);
        else if (logLevel === 'error' && typeof arguments[i] === 'string')
          arguments[i] = chalk.red(arguments[i]);
      }
      dashboardTui.logPane.log(...arguments);
    }
  }

  for (level of ['log', 'warn', 'debug', 'info', 'error'])
    exports[level] = logWrapperFactory(level);
}
