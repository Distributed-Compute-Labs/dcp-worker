/**
 * @file       blessed-components/sandboxes.js
 * @author     Ryan Rossiter, ryan@kingsds.network
 * @date       April 2020
 * @author     Wes Garland, wes@distributive.network
 * @date       May 2024
 *
 * This blessed component produces labeled progress bars to render the progress of worker sandboxes.
 * These are called sandboxRows.
 */
'use strict';

const blessed = require('blessed');

class SandboxPane extends blessed.Box
{
  constructor(options)
  {
    super(options);
    this.sandboxRows = [];
    this.update();
  }

  /**
   * Create a new progress bar, and associate it with the sandboxData object that it will read to
   * update its state.
   */
  createSandboxRow(sandboxData)
  {
    let progressBar = new blessed.ProgressBar({
      parent: this,
      orientation: 'horizontal',
      top: this.sandboxRows.length,
      left: 0,
      right: 0,
      height: 1,
      style: { bg: 'black' },
    });

    const text = new blessed.Text({
      parent: this,
      content: '<initializing>X', /* bug: last char truncates */
      wrap: false,
      top: this.sandboxRows.length,
      left: 0,
      right: 0,
      style: { transparent: true }
    });

    const sandboxRow = { progressBar, text, sandboxData };
    this.sandboxRows.push(sandboxRow);
    this.updateSandboxRow(sandboxRow);
    sandboxRow.update = () => this.updateSandboxRow(sandboxRow);
    sandboxRow.delete = () => this.deleteSandboxRow(sandboxRow);
    return sandboxRow;
  }

  /* Update a single progress bar's appearance, based on sandboxData */
  updateSandboxRow(sandboxRow)
  {
    const { progressBar, text, sandboxData } = sandboxRow;

    if (sandboxData.label)
      text.setContent(sandboxData.label + ' ' /* bug - last char gets trunc'd */);

    if (!sandboxData.slice.number)
    {
      progressBar.style.bar.bg = 'black';
      text.style.fg = 'cyan';
      progressBar.setProgress(100);
    }
    else if (sandboxData.slice.progress >= 0)
    {
      progressBar.style.bar.bg = 'green';
      text.style.fg = 'white';
      progressBar.setProgress((sandboxData.slice.progress * 0.99) + 1); /* draw the first tick asap */
    }
    else /* indeterminate progress */
    {
      progressBar.style.bar.bg = 'blue';
      text.style.fg = 'white';
      progressBar.setProgress(100);
    }
  }

  deleteSandboxRow(sandboxRow)
  {
    const idx = this.sandboxRows.indexOf(sandboxRow)
    if (idx === -1)
      return;
    this.sandboxRows.splice(idx, 1);
    for (let i=idx; i < this.sandboxRows.length; i++)
    {
      this.sandboxRows[i].progressBar.position.top -= 1
      this.sandboxRows[i].text.position.top -= 1
    }

    sandboxRow.text.destroy();
    sandboxRow.progressBar.destroy();
  }

  /* Update all everything in the progress bar pane */
  update()
  {
    this.sandboxRows.forEach(sandboxRow => this.updateSandboxRow(sandboxRow));
    this.setLabel(`${this.options.label} (${this.sandboxRows.length})`);
    this.screen.render();
  }
}

exports.sandboxPaneFactory = function sandboxPaneFactory(...args) {
  return new SandboxPane(...args);
};
