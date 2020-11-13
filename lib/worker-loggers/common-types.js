/**
 * @typedef WorkerLogger
 * @property {onSandboxReady} onSandboxReady
 * @property {function} onPayment
 * @property {function} onFetchingSlices
 * @property {function} onFetchedSlices
 * @property {function} onFetchSlicesFailed
 * @property {SandboxCallback} sandbox$onSliceStart
 * @property {SandboxCallback} sandbox$onSliceProgress
 * @property {SandboxCallback} sandbox$onSliceFinish
 * @property {SandboxCallback} sandbox$onWorkerStop
 */

/**
 * @typedef {function} onSandboxReady
 * @param {Sandbox} sandbox
 * @returns {object} workerData
 */

/**
 * @typedef {function} SandboxCallback
 * @param {Sandbox} sandbox
 * @param {object} workerData
 */