/**
 * @typedef SupervisorLogger
 * @property {onSandboxStart} onSandboxStart
 * @property {function} onDccCredit
 * @property {function} onFetchingSlices
 * @property {function} onFetchedSlices
 * @property {function} onFetchSlicesFailed
 * @property {WorkerCallback} sandbox$onSliceStart
 * @property {WorkerCallback} sandbox$onSliceProgress
 * @property {WorkerCallback} sandbox$onSliceFinish
 * @property {WorkerCallback} sandbox$onWorkerStop
 */

/**
 * @typedef {function} onSandboxStart
 * @param {DistributedWorker} worker
 * @returns {object} workerData
 */

/**
 * @typedef {function} WorkerCallback
 * @param {DistributedWorker} worker
 * @param {object} workerData
 */