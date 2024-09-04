# DCP-Worker

This is the official DCP Worker program for the Distributive Compute Platform.

This package implements a DCP Worker which can be executive interactively, or a system service, using
Node.js to communicate with the scheduler and control the DCP Evaluator.

A companion program, the DCP Evaluator, is required to use this worker. When you install the DCP Worker
with your system's package manager, the installer will automatically install the DCP Evaluator as
`dcp-evaluator-v8`. The DCP Evaluator is a secure sandboxing tool which uses the V8 JavaScript engine
and the Dawn WebGPU engine from Google to execute JavaScript, WebAssembly, and WebGPU code.

You can find a complete package for Linux, including Evaluator binaries at https://archive.distributed.computer/releases/,
and documentation at https://docs.distributed.computer/worker/readme.html.  If you are a developer
who interested in porting the Evaluator to your own platform, please contact us and we will
grant you early access to the MIT-licensed source code.  The build is CMake with GN and largely
based around V8.

This package is also used for DCP LocalExec, a local debugging tool for developers using DCP Client.

## Release Notes
This document was last updated Aug 27, 2024.

### Supported Platforms
- Node.js (all maintenance, active, current releases)
- Microsoft Windows 10, 11
- Ubuntu Linux 20.04
- Ubuntu Linux 22.04
- Ubuntu Linux 24.04
- More to come

## Manifest
| File                       | Purpose
|:---------------------------|:------------------------------------------------
| bin/dcp-worker             | Program which requests work from the scheduler and coordinates its evaluation in a secure environment called dcp-evaluator-v8
| bin/dcp-evaluator-start    | Program which launches dcp-evaluator-v8
| bin/dcp-evaluator-manager  | Program which which manages the launching of dcp-evaluator-v8; e.g. based on system load, terminal activity, screensaver activity, etc.
| etc/dcp-worker-config.js   | Default configuration for dcp-worker

### Related Packages
- dcp-evaluator-v8, our isolated JS/WASM/WebGPU evaluation environment, ships separately. Installing dcp-worker with your system's package manager will automatically install dcp-evaluator-v8 as a dependency.

## Troubleshooting
The following conditions must be met for a Worker to do work:
* the Evaluator must be startable - normally managed with `dcp-evaluator-manager`
* the Worker must be running
* there must be work available on the scheduler that is suitable for this worker
  * the worker must have the correct capabilities (GPU?)
  * the job's payment must exceed the worker's minimum wage
  * the worker and the job must be in the same Compute Group

### Check: Evaluator is running
This varies from platform to platform. This document assumes the Worker was installed from an OS-specific package supplied by Distributive.

#### Microsoft Windows
The Evaluator is automatically started by the Distributive Screensaver.

#### Ubuntu Linux
On Ubuntu Linux, the Evaluator is started by `dcp-evaluator-manager`, under the control of
[systemd](https://systemd.io/), running as the user `dcp`. The Evaluator Manager is responsible for
disabling the Evaluator when the system load changes, the screen saver deactivatees, or a terminal
becomes active.

| Action                     | Command
|:---------------------------|:------------------------------------------------
| View all DCP systemd units | systemctl --no-pager list-units 'dcp-*' --all
| Stop the Evaluator         | sudo systemctl stop dcp-evaluator-manager
| Start the Evaluator        | sudo systemctl start dcp-evaluator-manager
| Restart the Evaluator      | sudo systemctl restart dcp-evaluator-manager
| View the journal (logs)    | sudo systemctl journalctl -u dcp-evaluator-manager -f

### Check: Worker is running
This varies from platform to platform. This document assumes the Worker was installed from an
OS-specific package supplied by Distributive.

#### Microsoft Windows
The Worker is installed as a Windows Service, and can be managed via the Windows Service Manager.
To open the Windows Services Manager on Windows 10 or 11:
* Press Windows-X or right-click the start button to open the WinX menu
* Choose `Run`
* Type `sevices.msc` in the Run box and press enter

#### Ubuntu Linux
On Ubuntu Linux, the Worker is started under the control of [systemd](https://systemd.io/), running as
the user `dcp`. The Worker communicates with the Scheduler and uses an Evaluator to execute workload.

| Action                     | Command
|:---------------------------|:------------------------------------------------
| View all DCP systemd units | systemctl --no-pager list-units 'dcp-*' --all
| Stop the Worker            | sudo systemctl stop dcp-worker
| Start the Worker           | sudo systemctl start dcp-worker
| Restart the Workr          | sudo systemctl restart dcp-worker
| View the journal (logs)    | sudo systemctl journalctl -u dcp-worker -f

### Check: Worker is working

#### All Operating Systems
The `dcp-worker` program in this package normally runs as a system service, but it can also be run as an
interactive program. This program displays configuration information and shows what it is doing with the
Evaluator in real time.  `dcp-worker -h` shows a help screen; to run in interactive mode, simply start
`bin/dcp-worker` from a terminal window without any `-o` options.

Administrators with a large number of workers may wish to configure [syslog](https://en.wikipedia.org/wiki/Syslog)
logging, and use an off-the-shelf logging aggregation service. The full gamut of options relating to
syslog output are documented in the `dcp-worker` help screen. Note that only one type of output at a
time is currently possible with `dcp-worker`; Linux administrators who want both system journals and
syslog output will need to configure their local syslog service to receive messages from systemd.

#### Microsoft Windows
The DCP Worker service writes logs to the Windows Event Viewer. To open the event viewer on Windows 10 or
11, click
* Start
* Control Panel
* System and Security
* Administrative Tools

Next, double-click Event Viewer, and select DCP Worker logs.

#### Ubuntu Linux
The default configure runs `bin/dcp-worker -o console`, which sends log output to stdout/stderr; this
output is captured by systemd and recorded in the system journals.
`sudo systemctl journalctl -u dcp-worker --since='15 minutes ago'` will show recent activity.

## Systems  Integration
This DCP Worker package can be integrated into a wide variety of systems. Distributive currently
(Aug 2024) ships a Windows screensaver, an Ubuntu (Debian) package, and a Dockerized version of the
Debian package.

Systems integrators should be aware that the Evaluator (processes named `dcp-evaluator-v8`) can be
killed at any time to immediately decrease system load. A program called `dcp-evaluator-manager`
can be used to automate this; it can kill running Evaluators based on screensaver or terminal activity,
and refuse to spawn new Evaluators based on current system load.  Systems Integrators familiar with
`inetd` will understand that `dcp-evaluator-manager` is a variation on this theme, and can be replaced
a similar program should a more suitable one exist to manage load for the environment in question.

Systems integrators leave the `dcp-worker` program running as much as possible. This process consumes
very few resources, but manages the transmission of results to the Scheduler. During system shutdown,
delivering a single SIGINT to `dcp-worker` will cause it submit all pending results to the Scheduler,
return all pending slices, etc.  This graceful shutdown will take less than 30 seconds (usually much
less).

No DCP job or process will be irrepairably damanged by killing any process on a Worker node. The worst
that can happen is that work with pending results will be routed to another node.

## DCP Glossary
### Entities

#### Scheduler
A Node.js daemon which
* receives work functions and data sets from Compute API
* slices data into smaller sets
* transmits work and data points to Worker
* determines cost of work and instructs the Bank to distribute funds between entities accordingly
* ensures that all tasks eventually complete, provided appropriate financial and computation resources can be deployed in furtherance of this goal

#### Bank
A Node.js daemon which
* manages a ledger for DCC. This is not a blockchain currency.
* enables the movement of DCC between entities requesting work and entities performing work
* enables the movement of DCC between the ledger and the blockchain
* enables the placement of DCC in escrow on behalf of the Scheduler for work which is anticipated to be done

#### Compute Group
A collection of Workers and Jobs

#### Portal
A user-facing web application which allows or enables
* creation and management of user accounts
* management of bank accounts (ledgers)
* transfer of DCC between bank accounts
* transfer of DCC to and from the blockchain
* execution of the browser-based Worker

#### Worker
A JavaScript program which includes a Supervisor and one or more Sandboxes
* performs computations
* retrieves work and data points from Scheduler
* retrieves work dependencies from Package Server
* returns results and cost metrics to Scheduler
* Specific instances of Worker include
  - a browser-based Worker
  - a standalone Worker operating on Google's v8 engine

#### Sandbox
A component of a Worker, used to execute arbitrary JavaScript code in a secure environment.

#### Supervisor
The component of a Worker which communicates with the Scheduler and Sandboxes.

### Concepts
#### Job
The collection consisting of an input set, Work Function and result setup.  Referred to in early versions of the Compute API (incorrectly) as a Generator.

#### Slice
A unit of work, represented as source code plus data and meta data, which has a single entry point and return type.  Each Slice in a Job corresponds to exactly one element in the Job's input set.

#### Task
A unit of work which is composed of one or more slices, which can be executed by a single worker.  Each Slice of each Task will be from the same Job.

#### Work or Work Function
A function which is executed once per Slice for a given Job, accepting the input datum and returning a result which is added to the result set.

#### Module
A unit of source code which can be used by, but addressed independently of, a Work Function. Compute API modules are similar to CommonJS modules.

#### Package
A group of related modules

#### Distributed Computer
A parallel supercomputer consisting of one or more schedulers and workers.  When used as a proper noun, the distributed computer being discussed is the one hosted at https://portal.distributed.computer/

#### Bank Account
A ledger which acts a repository for DCC which is not on the block chain.  The Bank can move DCC between Bank Accounts much more quickly than it can move DCC between Addresses on the Ethereum block chain network.  Meta data attached to bank accounts can restrict certain operations, such as ear-marking funds for use only by job deployment.

#### Address
A unique identifier in DCP which can be used to identity a bank account, user, compute group, etc.

#### Key
A secret number that corresponds to an address. The address can be derived mathematically from the key, but the key cannot be derived from the address. In DCP, access is granted to a resource identitified by an address by signing a message with the key. This a very common public-key-private-key encryption technique, and is why it is important to safeguard your keys.

#### Keystore
A data structure which stores a key. The key can be safeguarded from prying eyes by encrypting it with a passphrase within the keystore.

### Keystore File
A file which stores a Keystore.

#### Wallet
A collection of Keystores.
