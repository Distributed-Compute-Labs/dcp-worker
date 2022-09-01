/**
 * @file        dcp-config.js
 *              Configuration values for the standalone Worker package.
 *              These values have a higher precedence than the scheduler-provided values,
 *              but can be overridden via the usual dcp-config semantics -- .dcp, /etc, 
 *              Windows Registry, etc.  See dcp-client library documentation for details.
 *              Specify DCP_CONFIG in the environment to use an alternate module.
 *
 * @author      Wes Garland
 * @date        Feb 2021
 */

const dcpConfig =
{
  worker: { /******* Note: all properties passed to web; no filtering! ********/

    trustComputeGroupOrigins: true, // trust the scheduler to give network access to origins on a per-compute-group basis

    /* Allow lists permitting supervisor network access beyond DCP messages to services */
    allowOrigins: {
      any: [],
      fetchWorkFunctions: [],
      fetchArguments: [],
      fetchData: [],
      sendResults: [],
    },

    minimumWage: {
      CPU:  0,
      GPU:  0,
      'in': 0,
      out:  0,
    },

    computeGroups: {},              // integer-one-indexed; format is 1:{ joinKey,joinHash } or 2:{ joinKey, joinSecret }
    jobAddresses: [],               // Specific job addresses the worker may work on. If not empty, worker will only work on those jobs.
    maxWorkingSandboxes: 1,
    defaultPaymentAddress: null,    // user must to specify
    evaluatorOptions: {}            /** @todo: add default options here. Note: right now they will be a bit off until we get localexec's evaluator a bit less special cased. */
  },
  evaluator:
  {
    listen: new URL('dcpsaw://localhost:9000/'),
    libDir: '../libexec/evaluator', // relative to prefix
  },

  standaloneWorker:
  {
    quiet: false,
    debug: process.env.DCP_SAW_DEBUG,
    evaluatorConnectBackoff:
    {
      maxInterval:   5 * 60 * 1000, // max: 5 minutes
      baseInterval:      10 * 1000, // start: 10s
      backoffFactor: 1.1            // each fail, back off by 10%
    },
    reloadBehaviour: 'process.exit(12)',
  },
}

if (!dcpConfig.evaluator.location)
  dcpConfig.evaluator.location = new URL(dcpConfig.evaluator.listen.href);

Object.assign(exports, dcpConfig);
