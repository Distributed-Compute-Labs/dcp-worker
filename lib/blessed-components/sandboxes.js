/**
 *  @file       blessed-components/sandboxes.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       April 2020
 * 
 *  This blessed component produces labeled progress bars
 *  to render the progress of worker sandboxes.
 */

const { Box, ProgressBar, Text } = require('blessed');

class Sandboxes extends Box {
  constructor(options) {
    super(options);

    this.data = options.data || [];
    this.progressBars = [];
    if (options.defaultProgressBars) {
      [...Array(options.defaultProgressBars)].map(
        () => this.createProgressBar());
    }

    this.update();
  }

  createProgressBar({ progress=0, label='IDLE', indeterminate=true }={}) {
    let progressBar = new ProgressBar({
      parent: this,
      orientation: 'horizontal',
      filled: progress,
      top: this.progressBars.length,
      left: 0, right: 1,
      height: 1,
      style: {
        bg: 'black',
        bar: {
          bg: indeterminate? 'blue' : 'green',
        },
      }
    });
    let labelElement = new Text({
      parent: this,
      content: label + ' ',
      top: this.progressBars.length,
      left: 0, right: 1,
      style: {
        transparent: true,
      }
    });

    this.progressBars.push({
      progressBar,
      label: labelElement,
    });
    return progressBar;
  }

  updateProgressBar(i, { progress=0, label='IDLE', indeterminate=true }={}) {
    this.progressBars[i].progressBar.setProgress(progress);
    // Add a space because for some reason the last char gets truncated
    this.progressBars[i].label.setContent(label + ' ');

    this.progressBars[i].progressBar.style.bar.bg = indeterminate? 'blue' : 'green';
  }

  update(data=this.data) {
    this.data = data;
    for (let i = 0; i < this.data.length; i++) {
      if (i < this.progressBars.length) {
        this.updateProgressBar(i, this.data[i]);
      } else {
        this.createProgressBar(progress);
      }
    }

    if (this.data.length < this.progressBars.length) {
      for (let i = this.data.length; i < this.progressBars.length; i++) {
        this.updateProgressBar(i);
      }
    }

    this.setLabel(`${this.options.label} (${this.data.length}/${this.options.defaultProgressBars})`);
  }
}

Object.assign(exports, {
  sandboxes(...args) {
    return new Sandboxes(...args);
  },
});
