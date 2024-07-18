/**
 * @file        dcp-worker-config.js
 *              Default configuration for the standalone DCP Worker package.
 *              Copy this file before modifying, so that changes are preserved
 *              during the upgrade cycle. If this file is in the "/opt/dcp/.dcp"
 *              directory as the result of an application install, do:
 *              - sudo --user dcp cp /opt/dcp/.dcp/dcp-worker-config.js /opt/dcp/.dcp/dcp-config.js
 *              Otherwise, suggested locations include:
 *              - /etc/dcp/dcp-worker/dcp-config.js, or
 *              - ~/.dcp/dcp-worker/dcp-config.js.
 *
 *              Those files have a higher precedence than the configuration
 *              that ships with the npm package; changes made in those files
 *              will be merged into the running configuration, overriding the
 *              defaults specified here.
 *
 *              Windows users can also affect these changes by adding entries
 *              to the registry. This is the preferred method for enterprise
 *              deployment.
 *
 * @author      Wes Garland
 * @date        Feb 2021
 */
{
  /* The DCP Worker Supervisor spawns evaluator sandboxes that execute job slices. */
  worker: {
    /* The DCP Bank account where earned funds are deposited by default, of the
     * form: '0x718cABAabA0d3E85292FD8bCFb78B9f0368d612c'.
     */
    paymentAddress: undefined,

    /* The number of CPU/GPU cores that the worker can use. */
    /*
    cores: {
      cpu: 7,
      gpu: 1,
    }
    */

    /* The percentage of this machine's cores to use by default. */
    defaultCoreDensity: {
      cpu: 0.9,
      gpu: 0.75,
    },

    /* Maximum number of sandboxes that can run at the same time. */
    /*
    maxSandboxes: 10,
    */

    /* Trust the scheduler to modify allowOrigins via Compute Group configuration. */
    trustComputeGroupOrigins: true,

    /* Allow lists permitting supervisor network access beyond DCP messages to services. */
    allowOrigins: {
      // Allowed to fetch work functions only from these sources
      fetchWorkFunctions: [ dcpConfig.scheduler.location.origin ],
      // Allowed to fetch job arguments only from these sources
      fetchArguments:     [ dcpConfig.scheduler.location.origin ],
      // Allowed to fetch input set data only from these sources
      fetchData:          [ dcpConfig.scheduler.location.origin ],
      // Allowed to submit results only to these sources
      sendResults:        [ dcpConfig.scheduler.location.origin ],
      // Allowed to fetch anything from these sources
      any:                [],
    },

    /* Vector describing the lowest-value work this worker will accept. */
    minimumWage: {
      'CPU':  0, /* DCC per second of CPU time */
      'GPU':  0, /* DCC per second of GPU time */
      'in':   0, /* DCC per byte of inbound network traffic */
      'out':  0, /* DCC per byte of outbound network traffic */
    },

    /* Extra Compute Groups this worker can participate in. Join credentials are
    * supplied by Distributive and/or local IT staff at site-licensed locations.
    */
    computeGroups: [
      // { joinKey: 'demo', joinSecret: 'secret' },
      // { joinKey: 'demo', joinHash: 'eh1-...' },
      // keystore('~/.dcp/demo'),
    ],

    /* Can be false to work on any job, or an array of job ID strings (eg.
     * ['0xF9D2...F537']) to restrict work to only these jobs.
     */
    jobAddresses: false,
  },

  /* The DCP Worker Evaluator is a secure environment used by DCP Worker
   * sandboxes. This configuration specifies where this worker's evaluator is
   * listening. Killing the evaluator stops all work from happening on this
   * worker; the worker will run in the background waiting for it to re-launch
   * when this happens.
   */
  evaluator: {
    listen: new URL('dcpsaw://localhost:9000/'),
  },

  /* Used to verify that the configuration file was loaded. */
  cookie: require('process').env.DCP_CONFIG_COOKIE,
}
