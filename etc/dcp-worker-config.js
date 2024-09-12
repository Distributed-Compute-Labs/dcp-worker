/**
 * @file        dcp-worker-config.js - Default configuration for the DCP Worker.
 *              Copy this file before modifying, so that changes are preserved during the upgrade cycle.
 *              Remove (or comment out) settings you don't need to change, so that changes to the
 *              defaults can be made during an upgrade. Suggested locations include:
 *              - /etc/dcp/dcp-worker/dcp-config.js, or
 *              - ~/.dcp/dcp-worker/dcp-config.js.
 *
 *              Those files have a higher precedence than the configuration that ships with the
 *              package; changes made in those files will be merged into the running configuration,
 *              overriding the defaults specified here.
 *
 *              Windows users can also affect these changes by adding entries to the registry. This is
 *              the preferred method for enterprise deployment.
 *
 * @author      Wes Garland, wes@distributive.network
 * @date        Feb 2021, Sep 2024
 */
{
  worker: {
    utilitization: { cpu: 1.0, gpu: 0.75 },    /* proportion of this machine's resources to use by defaut. */
    maxSandboxes: undefined,                   /* maximum number of sandboxes working or idling, undefined = auto */
    cores: { cpu: undefined, gpu: undefined }, /* how many cpus/gpus this machine has; undefined = detect */
    paymentAddress: undefined,                 /* Bank account for earnings; undefined = read ~/.dcp/default.keystore */

    /* allowOrigins permit job-related network access by URL origin, default is none */
    allowOrigins: {
      fetchWorkFunctions: [ dcpConfig.scheduler.location.origin, ],
      fetchArguments:     [ dcpConfig.scheduler.location.origin, ],
      fetchData:          [ dcpConfig.scheduler.location.origin, ],
      sendResults:        [ dcpConfig.scheduler.location.origin, ],
      any:                [],
    },
    trustComputeGroupOrigins: true, /* Allow the scheduler to modify allowOrigins via Compute Group configuration */

    /* Lowest-value work this worker will accept - should be based on local cost */
    minimumWage: {
      'CPU':  0, /* DCC per second of CPU time */
      'GPU':  0, /* DCC per second of GPU time */
      'in':   0, /* DCC per megabyte of inbound network traffic */
      'out':  0, /* DCC per megabyte of outbound network traffic */
    },

    /* Extra Compute Groups this worker can participate in. Join credentials are supplied by
     * Distributive and/or local IT staff at site-licensed locations.
     */
    computeGroups: [
      // { joinKey: 'scott', joinSecret: 'tiger' },
      // { joinKey: 'scott', joinHash: 'eh1-672937c2b944982e071185b888770f8b8ea67c11f56d545e403e0d513c609b87' },
      // keystore('~/.dcp/scott'),
    ],
  },

  /* The evaluator is a secure environment used by DCP Worker sandboxes. This configuration specifies
   * where this worker's evaluator is listening. Killing the evaluator stops all work from happening on
   * this worker; the worker will run in the background waiting for it to re-launch when this happens.
   */
  evaluator: {
    listen: new URL('dcpsaw://localhost:9000/'),
  },

  cookie: require('process').env.DCP_CONFIG_COOKIE,   /* Used to verify that this file was loaded. */
}
