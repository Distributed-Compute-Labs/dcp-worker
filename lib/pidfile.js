/**
 * @file        pidfile.js
 *              Library code to record/remove pid files
 *
 * @author      Robert Mirandola, robert@distributive.network
 * @author      Wes Garland, wes@distributive.network
 * @date        April 2023
 */
'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Write a pid file for the current process. This file contains only the process' pid. Before the file
 * is written, we to check to see if there is already a file there. If there is we warn, and -- if there
 * is a process running with that pid -- we exit the process after briefly blocking the event loop.
 *
 * As the pid file is created, we register a cleanup which removes the file when the process exits. The
 * cleanup depends on the process<dcpExit> event fired by dcp-client during process tear-down.
 *
 * @param {string} filename           the location of the pid file
 */
exports.write = function pidfile$$write(filename)
{
  var fd;
  
  if (fs.existsSync(filename))
  {
    console.warn(`Warning: found pidfile at ${filename}`);
    let oldPid = parseInt(fs.readFileSync(filename, 'utf8'), 10);

    try
    {
      if (oldPid)
        process.kill(oldPid, 0);
    }
    catch(error)
    {
      if (error.code === 'ESRCH') /* no such process */
      {
        oldPid = 0;
        removePidFile();
      }
    }

    if (oldPid)
    {
      console.error(`Process at PID ${oldPid} is still running; cannot start new process with pidfile ${filename}`);
      require('dcp/utils').sleep(3); /* put the brakes on a respawn loop */
      process.exit(1);
    }
  }

  try
  {
    fd = fs.openSync(filename, 'wx');
    fs.writeSync(fd, Buffer.from(process.pid + '\n'), 0);
    process.on('dcpExit', removePidFile);   // Cleanup PID file on exit
  }
  catch (error)
  {
    console.warn(`Warning: Could not create pidfile at ${filename} (${error.code || error.message})`);
    removePidFile();
  }

  function removePidFile()
  {
    try
    {
      fs.unlinkSync(filename);
      if (typeof fd === 'number')
        fs.closeSync(fd);
    }
    catch (error)
    {
      console.warn(`Warning: Could not remove pidfile at ${filename} (${error.code})`);
    }
  }
}

/**
 * Generate a default pidfile name for the current process
 *
 * @param {string} basename     optional, name of current process
 * @returns string which contains an absolute path
 */
exports.getDefaultPidFileName = function getDefaultPidFileName(basename)
{
  var defaultPidFileName = basename || path.basename(require.main.filename, '.js') + '.pid';

  if (!path.isAbsolute(defaultPidFileName))
    defaultPidFileName = path.resolve(__dirname, '..', 'run', defaultPidFileName);

  return defaultPidFileName;
}
