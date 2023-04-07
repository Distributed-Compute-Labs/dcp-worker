/**
 * @file        remote-console.js
 *              DCP Service Worker support for a remote console, accessible via telnet.
 *
 *              * SECURITY NOTICE *
 *
 *              This feature is turned off by default and should not be turned on except for
 *              troubleshooting, as any attacker on the network will have the same OS-level
 *              priviledges as the DCP Service Worker.
 *
 *              To enable this feature, create a file in ../etc named enable-debug-console. That
 *              file should contain a number which identities the port number this service will
 *              listen on.
 *
 *              The port file could also contain the string "false", which is just an explicit
 *              way of turning this feature off.
 *
 *              A history file will also be created in the etc directory, assuming the service
 *              worker has permission to write there.
 *
 * @author      Wes Garland, wes@kingsds.network
 * @date        Dec 2021
 */
'use strict';

const path = require('path');
const fs   = require('fs');
var dcpConfig;
var mainEval;
var ci;

require('dcp-client'); /* plumb in modules from bundle even if library has not been initialized */
const debugging = require('dcp/internal/debugging').scope('dcp-worker');

function daemonEval()
{
  try {
    if (typeof dcpConfig === 'undefined')
      dcpConfig = require('dcp/dcp-config');
  }
  catch(e){};

  if (mainEval)
    return mainEval(arguments[0]);
  return eval(arguments[0]);
}

function callbackTelnet(port, client, registry) {
  debugging() && console.debug(' ! telnetd - listening on port', port);
}

/**
 * Function to let this module know about eval within the context of the main function in
 * the service worker.
 */
exports.setMainEval = function removeConsole$$setMainEval()
{
  mainEval = arguments[0];
}

exports.init = function remoteConsole$$init(...commands)
{
  try
  {
    /* invoked before main */
    const edcFilename = path.resolve(__dirname, '..', 'etc', 'enable-debug-console');
    if (!fs.existsSync(edcFilename))
      return;
    const edc = fs.readFileSync(edcFilename, 'ascii').trim();
    if (edc === 'false')
      return;
    const port = parseInt(edc, 10);
    if (!port)
      throw new Error('invalid port: ' + edc);
    
    console.warn('*** Enabling telnet daemon on port', port, '(security risk) ***');

    ci = require('telnet-console').start({
      port,
      callbackTelnet,
      eval: daemonEval,
      histfile: edcFilename + '.history',
    }, ...commands);

    exports.init = () => {
      throw new Error('remote console has already been initialized');
    };
  }
  catch(e)
  {
    console.warn(' ! Failed to enable telnet daemon:', e.message);
  }
}

exports.reintercept = function remoteConsole$$reintercept()
{
  if (typeof ci === 'undefined')
    return; /* no interception => no reinterception */

  ci.reintercept();
}
