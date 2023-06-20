/**
 *  @file       worker-loggers/logfile.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module maintains a log file, writing all console logs to it.
 */
'use strict';

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);

/**
 *  Initialize the logfile worker logger
 *
 *  @param  {object}  options          Options for logger behaviour
 *  @param  {string}  options.filepath Path to worker file; default: ./dcp-worker.log
 *  @param  {boolean} options.truncate If true, logfile will be cleared at worker startup
 */
exports.init = function init(options)
{
  delete exports.init; // singleton   
  options.verbose >= 3 && _console.debug('050: constructing LogfileConsole', options.logfile, options);
  getLogFile(options);
  require('../startWorkerLogger').inspectOptions.colors = Boolean(process.env.FORCE_COLOR);
  
  // on SIGHUP, close the output stream and open a new one
  process.on('SIGHUP', () => {
    getLogFile(options);
  });
  
  exports.at = log;
}

/**
 *  Return a handle to the WritableStream for this logger, creating one if
 *  necessary.
 *
 *  @return {fs.WriteStream}
 */
function getLogFile(options)
{
  {
    const fs = require('fs');
    
    if (getLogFile._file)
    {
      try
      {
        getLogFile._file.end();
      }
      catch (err)
      {
        console.error('061: failed to close old log file:', err);
      }
      getLogFile._file = false;
    }
    
    const fileOptions = {
      flags: options.truncate ? 'w' : 'a',  // NYI: cli --truncate 
    }
    
    const file = getLogFile._file = fs.createWriteStream(options.logfile, fileOptions);
    
    // On error, close & recreate the log file
    file.on('error', err => {
      _console.error('082: console-patch::LogFileConsole write error:', err);
      
      getLogFile(options);
    });
    
    return file;
  }
}

/** Write a log line to the output file. 
 *  
 *  current outputStream.
 *  @param {string} level Log level.
 *  @param {any} ...items Items to log.
 */
function log(level, ...items)
{
  {
    const logPrefix = [
      (new Date()).toISOString(),
      level,
    ];

    const logElements = logPrefix.concat(items);

    try {
      getLogFile._file.write(logElements.join(' ') + '\n');
    }
    catch (error) {
      _console.error('131: Unexpected error writing to log file:', error);
    }
  }
}
