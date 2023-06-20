/**
 * @file        worker-loggers/console.js
 *              Logger interface which just logs to the node console on stdout/stderr.
 * @author      Wes Garland, wes@distributive.network
 * @date        June 2023
 */
'use strict';

const process = require('process');

exports.init = function console$$init(options)
{
  const myConsole = new (require('console').Console)(process);

  if (process.env.RAW_CONSOLE)
  {
    /* raw mode is used to debug node-inspect problems by dumping raw types directly to console.log */
    exports.raw = function console$$raw(level, ...args) {
      myConsole[level](...args);
    };
  }
  else
  {
    /* Log a single string to the console; conceptually very similar to other loggers */
    exports.at = function console$$at(level, ...args) {
      myConsole[level](args.join(' '));
    };
  }
}

