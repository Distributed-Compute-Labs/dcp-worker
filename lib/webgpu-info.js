/**
 *  @file       webgpu-capabilities.js
 *              Check evaluator to determine if webgpu is enabled, and what capabilities it has.
 *
 *  @author     Ryan Saweczko, ryansaweczko@distributive.network
 *
 *  @date       Sept 2024
 */
'use strict';

const kvin = require('kvin');
const evaluatorId = 'webgpuCheck';

async function eval$$webgpu()
{
  if (!(typeof navigator === 'object' && navigator.gpu))
    return { enabled: false };

  try
  {
    const info = {};
    const adapter = await navigator.gpu.requestAdapter();
    /*
     * Newer versions of dcp-evaluator use different methods to access the adapter info as the api changes/bugs are fixed.
     * `adapter.info`:                  spec-compliant method to access adapter info as of writing this (Sept 2024).
     *                                  dcp-evaluator versions supporting: None
     *
     * `adapter.requestAdapterInfo()`:  original method. Should return an object with enumerable properties.
     *                                  dcp-evaluator version < 7.2.0 have non-enumerable properties
     *                                  dcp-evaluator version >= 7.2.0 have enumerable properties
     */
    if (adapter.info)
    {
      for (let key in adapter.info)
        info[key] = adapter.info[key];
      return { enabled: true, info: info };
    }
    const properties = ['vendor', 'architecture', 'device', 'description'];
    const adapterInfo = await adapter.requestAdapterInfo();
    for (let key of properties)
      info[key] = adapterInfo[key];
    return { enabled: true, info: info };
  }
  catch (err)
  {
    return { enabled: false };
  }
}

/**
 * Connect to an evaluator instance and return back if webGPU is enabled, and if it is some information on the 
 * GPU device.
 * @param {object} evaluatorConfig - Object containing the hostname and port to connect to the evaluator instance on
 * @returns {Promise} which resolves with undefined detection failed (ie couldn't connect to evaluator), 
 *                    or the object {enabled, info} with info on if webgpu exists, and if so what the gpu is.
 */
function checkEvaluatorWebGPU(evaluatorConfig)
{
  const sbCon = require('dcp-client/lib/standaloneWorker').workerFactory(evaluatorConfig);
  const evaluatorHandle = new sbCon({ name: `DCP Sandbox #1`, });

  var noResponseTimeout, resolve;
  const p$webgpuInfo = new Promise((res, rej) => { resolve = res; }).finally(() => {
    evaluatorHandle.terminate();
    clearTimeout(noResponseTimeout);
  });
  // Promise intentionally left referenced for duration of function - evaluator connections do not add references
  // by themselves, so the dcp-worker process will exit without this.
  noResponseTimeout = setTimeout(() => { resolve(); }, 1000);
  
  evaluatorHandle.onmessage = function onmessage(event)
  {
    const reply = kvin.unmarshal(event.data).value;
    if (reply.request === `evalResult::${evaluatorId}`)
      resolve(reply.data);
  }

  const message = {
    request: 'eval',
    data: '(' + eval$$webgpu.toString() + ')()',
    msgId: evaluatorId,
  }
  evaluatorHandle.postMessage(kvin.marshal(message));
  return p$webgpuInfo;
}

exports.checkWebGPU = checkEvaluatorWebGPU;
