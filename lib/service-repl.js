/**
 * @file        service-repl.js         Generic REPL setup for DCP Scheduler microservices. Supports both
 *                                      stdio and telnetd. Correct invocation allows evaluation of variables
 *                                      local to the microservice's main program:
 *
 *                                      require('../lib/service-repl').start(config, function svcEval() { return eval(arguments[0]) });
 *
 *                                      When the telnet mode is in use, a variable named `telnetd` is injected
 *                                      into the global namespace so that it can inspected by REPL users.
 *
 * @author      Wes Garland, wes@kingsds.network
 * @date        Sep 2020
 */
const telnet = require('telnet')

/** Start the REPL(s)
 *  @param      {object}        serviceConfig           dcpConfig fragment; this function uses the .repl key inside the fragment for configuration.
 *  @param      {function}      eval                    An eval-like function that is used to evaluate REPL commands within the right scope.
 */
exports.start = function serviceRepl$$start(serviceConfig, eval = eval) {
  var options = {
    eval: evalWrapper,
    prompt: serviceConfig.repl.prompt || '> ',
    useColors: true,
    ignoreUndefined: true,
    useGlobal: true,
  };

  if (require('module')._cache.niim instanceof require('module').Module)
    return; /* no REPL when running under niim */

  if (serviceConfig.repl.options)
    options = Object.assign(options, serviceConfig.repl.options);

  if (serviceConfig.repl.port) {
    let telnetReplOptions = Object.assign(options, {
      terminal: true
    });

    global.telnetd = { clients: [], connections: [] };
    telnetd.server = telnet.createServer(function (client) {
      let thisOptions = Object.assign(options, { socket: client });
      client.do.transmit_binary();
      client.do.window_size();

      client.write(`Connected to ${process.argv[1]}\n`);
      client.repl = require('repl').start(thisOptions);
      if (serviceConfig.repl.histfile && client.repl.setupHistory)
        client.repl.setupHistory(require('expand-tilde')(serviceConfig.repl.histfile), () => {});
                                               
      client.repl.on('reset', () => {
        client.write('REPL reset\n');
      });
      client.repl.on('exit', () => {
        try {
          client.write('REPL exit\n');
          client.end();
        }
        catch(e){}
        finally{
          telnetd.clients.splice(telnetd.clients.indexOf(client), 1);
        }
      });

      telnetd.clients.push(client);
    }).listen(serviceConfig.repl.port);

    telnetd.server.on('connection', (connection) => {
      telnetd.connections.push(connection);
      connection.on('end', () => {
        try {
          telnetd.clients.splice(telnetd.clients.indexOf(client), 1);
          telnetd.connections.splice(telnetd.clients.indexOf(connection), 1);
        } catch(e){};
      });
    });

    console.log(`Telnet REPL listening on ${serviceConfig.repl.port}`);
  }

  if (process.stdin.isTTY && serviceConfig.repl.stdin !== false) {
    let stdinReplOptions = Object.assign(options, {
      terminal: true
    });   
    let stdioRepl =  require('repl').start(stdinReplOptions);

    if (serviceConfig.repl.histfile && stdioRepl.setupHistory)
      stdioRepl.setupHistory(require('expand-tilde')(serviceConfig.repl.histfile), () => {});
  }

  function evalWrapper(cmd, context, filename, callback) {
    var code;

    cmd = cmd .replace(/;\n$/,'');
    if (cmd.startsWith('keys '))
      cmd = `Object.keys(${cmd.slice(5)})`;
    if (cmd.match(/^\s+$/))
      cmd='undefined';
    code = `(async () => (${cmd}))();`;
    eval(code).then((result) => callback(null, result)).catch((e) => callback(null, e));
  }
}
