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
    maxAllowedSandboxes: 0,    // this feature has unforseen side-effects, defaulted to off for now
    maxSandboxErrorsPerSlice: 2, // more than this many sandbox errors per slice cause it to be returned

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

    computeGroups: {},        // integer-one-indexed; format is 1:{ joinKey,joinHash } or 2:{ joinKey, joinSecret }
    leavePublicGroup: false,  // if true, will not fetch work from public group
    
    allowConsoleAccess: false,
    trustComputeGroupOrigins: true,
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
