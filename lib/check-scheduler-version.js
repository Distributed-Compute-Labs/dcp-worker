/**
 * @file        check-scheduler-version.js
 *              Perform a basic sanity check between versions of this code and the version
 *              information returned in the /etc/dcp-config.js from the scheduler during
 *              dcp-client initialization.
 * @author      Sam Cantor
 * @date        Nov 2012
 */

exports.check = function checkSchedulerVersion$$check(quiet)
{
  const dcpConfig = require('dcp/dcp-config');
  const schedulerConfig = dcpConfig.scheduler;

  // Check for old versions of the config
  if (!schedulerConfig.worker) {
    schedulerConfig.worker = {};
    schedulerConfig.worker.operations = '1.0.0';
    if (dcpConfig.worker.nativeEvaluator){
      schedulerConfig.worker.types = ['v4'];
    } 
    else {
      schedulerConfig.worker.types = ['v3'];
    } 
  }

  // Check if scheduler supports current worker version
  let currentWorkerType = 'v4';
  let currentWorkerVersion = '1.0.0';
  if (!Object.values(schedulerConfig.worker.types).includes(currentWorkerType) || 
      !require('semver').satisfies(schedulerConfig.worker.operations, '^'+currentWorkerVersion)) {
    console.error('\b**** Please update ****\b');
    console.error('The selected scheduler is not capable of running this worker version.');
    console.log(`Scheduler href:  ${dcpConfig.scheduler.location.href}\n` +
                `Scheduler wants: ${schedulerConfig.worker.types}, ${schedulerConfig.worker.operations}\n` +
                `This worker is:  ${currentWorkerType}, ${currentWorkerVersion}\n` +
                `dcp-client: ${require('util').inspect(require('dcp/build'))}\n`);
    if (process.env.CHECK_SEMVER !== 'false')
      process.exit(1);
  }

  if (!quiet)
    console.log(`The current scheduler supports worker type(s) ${Object.values(schedulerConfig.worker.types)} and operations ${schedulerConfig.worker.operations}`);
}
