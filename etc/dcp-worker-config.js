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
const workerConfig =
{
  worker: {
    trustComputeGroupOrigins: true,  /* Trust the scheduler to modify allowOrigins via Compute Group configuration */

    /* Allow lists permitting supervisor network access beyond DCP messages to services */
    allowOrigins: {
      fetchWorkFunctions: [ dcpConfig.scheduler.location ],
      fetchArguments:     [ dcpConfig.scheduler.location ],
      fetchData:          [ dcpConfig.scheduler.location ],
      sendResults:        [ dcpConfig.scheduler.location ],
    },

    /* Vector describing the lowest-value work this worker will accept. */
    minimumWage: {
      'CPU':  0, /* DCC per second of CPU time */
      'GPU':  0, /* DCC per second of GPU time */
      'in':   0, /* DCC per byte of inbound network traffic */
      'out':  0, /* DCC per byte of outbound network traffic */
    },

    /* Compute Groups this worker can participate in. Group labels must be unique; join 
     * credentials are supplied by Distributive and/or your local IT staff.
     */
    computeGroups: {
      // myGroupLabel1: { joinKey: 'scott', joinSecret: 'tiger' },
      // myGroupLabel2: { joinKey: 'scott', joinHash: 'eh1-672937c2b944982e071185b888770f8b8ea67c11f56d545e403e0d513c609b87' },
    },

    jobAddresses: [],               // Specific job addresses the worker may work on. If not empty, worker will only work on those jobs.
    maxWorkingSandboxes: 1,
    paymentAddress: null,           // user must to specify
    evaluatorOptions: {}            /** @todo: add default options here. Note: right now they will be a bit off until we get localexec's evaluator a bit less special cased. */
  },

  /* The evaluator is a secure environment for creating DCP Worker sandboxes, based on the
   * Google V8 Engine. This configuration specifies where this worker's evaluator daemon is
   * listening. Killing the evaluator stops all work from happening on this worker; the
   * worker will run in the background waiting for it to re-launch when this happens. 
   */
  evaluator: {
    listen: url('dcpsaw://localhost:9000/'),
    libDir: '../libexec/evaluator',
  },
}

if (!dcpConfig.evaluator.location)
  dcpConfig.evaluator.location = url(dcpConfig.evaluator.listen.href);

return workerConfig;
