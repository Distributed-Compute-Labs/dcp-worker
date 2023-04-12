/**
 * @file        dcp-worker-config.js
 *              Default configuration for the standalone DCP Worker package.
 *              Copy this file before modifying, so that changes are preserved
 *              during the upgrade cycle. Suggested locations:
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

({
  worker: {
    trustComputeGroupOrigins: true,  /* Trust the scheduler to modify allowOrigins via Compute Group configuration */

    /* Allow lists permitting supervisor network access beyond DCP messages to services */
    allowOrigins: {
      fetchWorkFunctions: [ dcpConfig.scheduler.location ],
      fetchArguments:     [ dcpConfig.scheduler.location ],
      fetchData:          [ dcpConfig.scheduler.location ],
      sendResults:        [ dcpConfig.scheduler.location ],
      any:                [],
    },

    /* Vector describing the lowest-value work this worker will accept. */
    minimumWage: {
      'CPU':  0, /* DCC per second of CPU time */
      'GPU':  0, /* DCC per second of GPU time */
      'in':   0, /* DCC per byte of inbound network traffic */
      'out':  0, /* DCC per byte of outbound network traffic */
    },

    /* Extra Compute Groups this worker can participate in. Join credentials are supplied by
     * Distributive and/or local IT staff at site-licensed locations.
     */
    computeGroups: [
      // { joinKey: 'scott', joinSecret: 'tiger' },
      // { joinKey: 'scott', joinHash: 'eh1-672937c2b944982e071185b888770f8b8ea67c11f56d545e403e0d513c609b87' },
      // keystore('~/.dcp/scott'),
    ],

    jobAddresses: [],               /* If specified, restrict the worker to only these jobs */
    paymentAddress: undefined,      /* Bank account where earned funds are transfered if not specified on command-line */
  },

  /* The evaluator is a secure environment for creating DCP Worker sandboxes, used when the Worker
   * is running in Node.js. This configuration specifies where this worker's evaluator daemon is
   * listening. Killing the evaluator stops all work from happening on this worker; the worker
   * will run in the background waiting for it to re-launch when this happens. 
   */
  evaluator: {
    listen:   new URL('dcpsaw://localhost:9000/'),
  },

  cookie: dcp['dcp-env'].getenv('DCP_CONFIG_COOKIE') /* used to verify that configuration file was actually loaded */
})
