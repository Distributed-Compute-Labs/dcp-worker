/**
 *  @file       blessed-components/log.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This blessed component is based on the blessed-contrib
 *  log component, but features text wrapping and behaves
 *  closer to the built-in console log methods.
 */

const { Box } = require('blessed');

class Log extends Box {
  constructor(options={}) {
    super(options);

    options.bufferLength = options.bufferLength || 35;
    this.options = options;

    this.logLines = [];
  }

  log(...args) {
    let str = args.reduce(
      (s, arg) => s += `${typeof arg === 'string'? arg : JSON.stringify(arg, null, 2)} `,
    '');

    this.logLines.push(str);
    
    if (this.logLines.length > this.options.bufferLength) {
      this.logLines.shift();
    }

    this.setContent(this.logLines.join('\n'));
    this.setScrollPerc(100);
  }
}

Object.assign(exports, {
  log(...args) {
    return new Log(...args);
  },
});
