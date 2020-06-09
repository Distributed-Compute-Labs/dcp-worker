# DCP-Worker

This is the official Node DCP Worker implementation for DCP, the Distributed Compute Protocol.
This code implements a Node-based DCP Worker and is used by the DCP Compute API job.localExec()
function under Node.

Note that, in order to run a Node DCP Worker, you also need a DCP Evaluator; we use a completely
separate build process, unrelated to NodeJS and NPM, to create our evaluators for security reasons.

You can find a complete package for Linux, including Evaluator binaries at https://archive.distributed.computer/releases/, 
and documentation at https://docs.distributed.computer/worker/readme.html.  If you are a developer
which is interested in porting the Evaluator to your own platform, please contact us and we will
grant you early access to the MIT-licensed source code.  The build is CMake with GN and largely
based around v8.


## Record of Issue

Date        |  Author          | Change
----------- | ---------------- | ---------------------------------------------
May 29 2020 | Wes Garland      | Early Developer Preview Release

## Release Notes

### Implementation Status
DCP is currently (May 2020) in testing for a limited set of developers under our Early Developer Preview program.  If you would like to be part of our *First Dev* cohort, visit https://dcp.dev/ and sign up!

### Supported Platforms
- NodeJS version 10 (LTS)
- NodeJS version 12 (LTS)
- Ubuntu Linux 18.04 (LTS)
- Ubuntu Linux 20.04 (LTS)
- More to come

### Related Products
Other utilities for developers working with DCP can be retrieved via npm, and include:

* [`dcp-client`](https://npmjs.com/package/dcp-client) - the official client library for DCP, the Distributed Compute Protocol
* [`dcp-util`](https://npmjs.com/package/dcp-util) - a series of utilities for working with DCP; manipulate keystores, cancel jobs, etc.
* [`niim`](https://www.npmjs.com/package/niim) - a command-line debugger for NodeJS (fork of node-inspect) which can debug DCP programs (passphrase prompts cause problems with node-inspect mainline)

## DCP Glossary
### Entities

#### Scheduler
A NodeJS daemon which
* receives work functions and data sets from Compute API
* slices data into smaller sets
* transmits work and data points to Worker
* determines cost of work and instructs the Bank to distribute funds between entities accordingly
* ensures that all tasks eventually complete, provided appropriate financial and computation resources can be deployed in furtherance of this goal

#### Bank
A NodeJS daemon which
* manages a ledger for DCC which are not on the blockchain
* enables the movement of DCC between entities requesting work and entities performing work
* enables the movement of DCC between the ledger and the blockchain
* enables the placement of DCC in escrow on behalf of the Scheduler for work which is anticipated to be done

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
A component of a Worker, used to execute arbitrary JavaScript code in a secure environment.  Currently implemented by the DistributedWorker class (whose name will change some day).  Generally speaking, we use one Sandbox per CPU core, although we might use more in order to work around system scheduler deficiencies, network overhead, etc.   Sandboxes in the web browser are implemented using window.Worker().

#### Supervisor
The component of a Worker which communicates with the Scheduler and Sandboxen.

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
A unique identifier in DCP which can be used as a Bank Account identifier (account number) or Address on the Ethereum network.

#### Wallet
In the general (blockchain) sense, a wallet is a piece of software that allows the user to interact with the greater economy as a whole.  So as your actual wallet in your pocket has your cash and credit cards and you access your wallet in order to make a purchase and keep records (by pulling out  cash or cards, and stuffing receipts back in), a blockchain wallet performs a similar function in that it gives you a place to store your private keys (your money), it provides a balance of what all those moneys add up to, it provides a way to receive moneys and send moneys, and provides a record of all those sends and receives. Most blockchain wallets provide at least 3 basic functions
1. generate and stores your public/private key pairs
2. allow you to use those key pairs through transactions (allows you to craft and transmit transactions to the peers)
3. keep a record of the transactions

Additionally, most of the current crypto wallets (such as Bitcoin core) provide blockchain validation and consensus functions in that they can act to create or validate new blocks to the chain in addition to creating or validating transactions.

##### Distributed.Computer Wallet
The Distributed.Computer acts as a Wallet; the platform exposes Wallet-related functionality both via software APIs and the portal web site.
 - Public/private key pairs are generated via the portal, wallet API, and command-line utilities
 - Public/private key pairs are stored in the database as passphrase-protected Keystores
 - Public/private key pairs stored in the Distributed.Computer Wallet can be retrieved via the portal webite

#### Keystore
A data structure which stores an encrypted key pair (address + private key). Generally speaking, the keystore will be encrypted with a passphrase.

### Keystore File
A file which stores a JSON-encoded Keystore.
