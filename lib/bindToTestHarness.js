/**
 *  @file       bindToTestHarness.js
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       May 2020
 */

function setObjProps(obj, source) {
  for (let p in source) {
    if (typeof source[p] === 'object') setObjProps(obj[p], source[p]);
    else obj[p] = source[p];
  }
}

exports.bindToTestHarness = function (worker) {
  worker.on('start', () => {
    process.send({
      request: 'Process Started'
    });
  });

  worker.on('fetch', () => {
    process.send({
      request: 'fetchedSlices'
    });
  });

  worker.on('sandbox', (sandbox) => {
    sandbox.on('sliceStart', () => {
      process.send({
        request: 'sliceStart'
      });
    });
  });

  worker.supervisor.once('capabilitiesCalculated', (originalCaps) => {
    let reportedCaps = originalCaps;

    Object.defineProperty(worker.supervisor, 'capabilities', {
      get: () => reportedCaps,
      set: v => reportedCaps = v,
    });

    process.on('message', ({ request, data }) => {
      const [namespace, method] = request.split('::');
      if (namespace !== 'dcpWorker') return
      if (method === 'setCaps') {
        // Deep copy the original caps
        reportedCaps = JSON.parse(JSON.stringify(originalCaps));
        setObjProps(reportedCaps, data);
      }
      else if (method === 'resetCaps') reportedCaps = originalCaps;
      // else if (method === 'reportCaps') console.error(reportedCaps);
    });
  });
}
