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
 *              To enable this feature, create a file in ../etc name enabled-debug-console. That
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
  console.log(' ! telnetd - listening on port', port);
}

/**
 * Function to let this module know about eval within the context of the main function in
 * the service worker.
 */
exports.setMainEval = function removeConsole$$setMainEval()
{
  mainEval = arguments[0];
}

exports.init = function remoteConsole$$init(port, ...commands)
{
  try
  {
    let historyFilename;
    
    if (!port)
    {
      /* invoked before main */
      const edcFilename = path.resolve(__dirname, '..', 'etc', 'enable-debug-console');
      if (!fs.existsSync(edcFilename))
        return;

      port = JSON.parse(fs.readFileSync(edcFilename, 'ascii').trim());
      if (!port)
        return;
      historyFilename = edcFilename + '.history';
    }
    else
    {
      historyFilename = path.resolve(__dirname, '..', 'etc', `telnetd-repl-port-${port}.history`);
    }
    
    if (port)
    {
      console.warn(`*** Enabling telnet daemon on port ${port} (security risk) ***`);
      ci = require('telnet-console').start({
        port,
        callbackTelnet,
        eval: daemonEval,
        histfile: historyFilename,
      }, ...commands);
      exports.init = () => {
        throw new Error('remote console has already been initialized');
      };
    }
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
