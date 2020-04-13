
class SupervisorMonitor {
  constructor(supervisor) {
    supervisor.on('sandboxStart', this.onSandboxStart.bind(this));
    supervisor.on('dccCredit', this.onDccCredit.bind(this));
    
    supervisor.on('fetchingSlices', this.onFetchingSlices.bind(this));
    supervisor.on('fetchedSlices', this.onFetchedSlices.bind(this));
    supervisor.on('fetchSlicesFailed', this.onFetchSlicesFailed.bind(this));
  }

  onSandboxStart(sandbox) {
    const zeroes = '000';
    const shortId = (zeroes + sandbox.id.toString(16).toUpperCase()).slice(-zeroes.length);
    const key = `Sandbox 0x${shortId}`;
    let name; // will be populated with the job name on sliceStart

    console.log(key, ': Initialized');

    sandbox.on('sliceStart', function supervisorMonitor$$onSandboxStart$onSliceStart(slice) {
      if (slice.job && slice.job.publicName) {
        name = slice.job.publicName;
      } else if (sandbox.job && sandbox.job.public) {
        name = sandbox.job.public.name;
      }
  
      console.log(key, `: Slice Started - "${name}"`);
    });

    sandbox.on('sliceProgress', function supervisorMonitor$$onSandboxStart$onSliceProgress(ev) {
      // something
    })
  
    sandbox.on('sliceFinish', function supervisorMonitor$$onSandboxStart$onSliceFinish(ev) {
      console.log(key, `: Slice Completed - "${name}"`);
    })
    
    sandbox.on('workerStop', function supervisorMonitor$$onSandboxStart$onWorkerStop(ev) {
      const jobAddress = sandbox.jobAddress ? sandbox.jobAddress.substr(0, 10) : sandbox.jobAddress;
      console.log(key, `: Terminated - Job address: ${jobAddress}`);
    })
  }

  onDccCredit({ payment }) {
    try {
      payment = parseFloat(payment);
    } catch (e) {
      console.error("Failed to parse payment float:", payment);
      return;
    }

    console.log(`DCC Credit: ${payment}`);
  }

  onFetchingSlices() {
    console.log("fetching slices uwu");
  }

  onFetchedSlices(ev) {
    console.log("yay fetch slices success!", ev);
  }

  onFetchSlicesFailed(ev) {
    console.log("fetch slices failed", ev);
  }
}

Object.assign(exports, {
  SupervisorMonitor,
});
