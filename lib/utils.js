
/**
 * @file        utils.js
 *              Shared library code.
 *
 * @author      Paul, paul@distributive.network
 * @date        August 2023
 */
'use strict';

/**
 * Figure out #slices fetched from the different forms of the 'fetch' event.
 * @param {*|string|number} task
 * @returns {number}
 */
function slicesFetched (task)
{
  if (typeof task === 'number') /* <= June 2023 Worker events: remove ~ Sep 2023 /wg */
    return task;
  if (typeof task === 'string') /* <= June 2023 Worker events: remove ~ Sep 2023 /wg */
    return parseInt(task) || 0;
  let slicesFetched = 0;
  for (const job in task.slices)
    slicesFetched += task.slices[job];
  return slicesFetched;
}

exports.slicesFetched = slicesFetched;
