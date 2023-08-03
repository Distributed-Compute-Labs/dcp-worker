
/**
 * @file        utils.js
 *              Shared library code.
 *
 * @author      Paul, paul@distributive.network
 * @date        August 2023
 */
'use strict';

function sliceFetched (task)
{
  if (typeof task === 'number' || typeof task === 'string') /* <= June 2023 Worker events: remove ~ Sep 2023 /wg */
    return task;
  slicesFetched = 0;
  for (const job in task.slices)
    slicesFetched += task.slices[job];
  return slicesFetched;
}

exports.sliceFetched = sliceFetched;
