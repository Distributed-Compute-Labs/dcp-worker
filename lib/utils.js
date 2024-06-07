
/**
 * @file        utils.js
 *              Shared library code.
 *
 * @author      Paul, paul@distributive.network
 * @date        August 2023
 */
'use strict';

const process = require('process');

/**
 * Figure out #slices fetched from the different forms of the 'fetch' event.
 * @param {*|string|number} task
 * @returns {number}
 */
function slicesFetched (task)
{
  /* eslint-disable-next-line no-shadow */
  let slicesFetched = 0;
  for (const job in task.slices)
    slicesFetched += task.slices[job];
  return slicesFetched;
}

/** thunk - ensures global debugging() symbol always available even if called before dcp-client init */
function debugging()
{
  require('dcp-client');
  debugging = require('dcp/internal/debugging').scope('dcp-worker'); // eslint-disable-line no-func-assign
  return debugging.apply(this, arguments); // eslint-disable-line no-invalid-this
}

/**
 * Flag to display detailed debug info in diagnostics.
 * @return {boolean}
 */
function displayMaxDiagInfo ()
{
  return Boolean(process.env.DCP_SUPERVISOR_DEBUG_DISPLAY_MAX_INFO) || debugging();
}

exports.slicesFetched = slicesFetched;
exports.debugging = debugging;
exports.displayMaxDiagInfo = displayMaxDiagInfo;
