/**
 * @file        worker-loggers/console.js
 *              Logger interface which just logs to the node console on stdout/stderr.
 * @author      Wes Garland, wes@distributive.network
 * @date        June 2023
 */
'use strict';

const process = require('process');

/**
 *  Initialize the console logger
 *
 *  @param  {object} options Any options affecting console behaviour. Not presently used.
 */
exports.init = function console$$init(options)
{
  const myConsole = new (require('console').Console)(process);
  var lastWasThrobber = false;

  delete exports.init; // singleton
  if (process.env.RAW_CONSOLE)
  {
    /* raw mode is used to debug node-inspect problems by dumping raw types directly to console.log */
    exports.raw = function console$$raw(level, ...args) {
      myConsole[level](...args);
    };
    return;
  }

  /* Log a single string to the console; conceptually very similar to other loggers */
  exports.at = function console$$at(level, ...args) {
    if (lastWasThrobber)
    {
      args.unshift(' \n');
      lastWasThrobber = false;
    }
    myConsole[level](args.join(' '));
  };

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

    const stream = throbFacility === 'error' || throbFacility === 'warn' ? process.stderr : process.stdout;

    if (throbArgsCache)
    {
      if (stream.isTTY)
        stream.write(throbArgsCache.args.join(' '));
      else
        console[throbArgsCache.throbFacility](...throbArgsCache.args);
      throbArgsCache = false;
    }

    if (stream.isTTY)
    {
      i = (i + 1) % throbChars.length;
      stream.write(throbChars[i] + '\u0008');
      lastWasThrobber = true;
    }
  }
}
