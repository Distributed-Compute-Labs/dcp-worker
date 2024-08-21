/**
 *  @file       blessed-components/log.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 *
 *  This blessed component is based on the blessed-contrib
 *  log component, but features text wrapping and behaves
 *  closer to the built-in console log methods.
 */
'use strict';

const { Box } = require('blessed');

const defaultOptions = {
  scrollable: true,
  bufferLength: 1000,
  mouse: true,
  keys: true,
  vi: true
};

class Log extends Box
{
  paused = false;

  constructor(options={})
  {
    options = Object.assign({}, defaultOptions, options);
    super(options);
    this.options = options;
    this.logLines = [];

    this.screen.key(['C-s'], () => this.paused = true);
    this.screen.key(['C-q'], () => this.paused = false);
    this.screen.key([' '], () => {
      this.paused = false;
      this.setScrollPerc(100);
    });
  }

  log(...args)
  {
    const str = args.reduce(
      (s, arg) => (s += `${typeof arg === 'string'? arg : JSON.stringify(arg, null, 2)} `),
    '');

    this.logLines.push(str);

    if (this.logLines.length > this.options.bufferLength)
      this.logLines.shift();

    this.setContent(this.logLines.join('\n'));
    if (!this.paused)
      this.setScrollPerc(100);
  }
}

Object.assign(exports, {
  log(...args) {
    return new Log(...args);
  },
});
