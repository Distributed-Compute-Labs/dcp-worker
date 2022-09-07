/**
 *  @file       worker-loggers/logfile.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2022
 *
 *  This logger module maintains a log file, writing all console logs to it.
 *  Most worker events are passed through to the console logger.
 */

require('./common-types');
const consoleLogger = require('./console');

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);

const logfileLogger = {
  /**
   *  Initialize the logfile worker logger
   *
   *  @param  {Worker} worker           DCP Worker object to log
   *  @param  {object} options          Options for logger behaviour
   *  @param  {string} options.filepath Path to worker file; default: ./dcp-worker.log
   *  @param  {bool}   options.truncate If true, logfile will be cleared at worker startup
   */
  init(worker, options) {
    consoleLogger.init(worker, options);
    
    this._filepath = options.filepath || './dcp-worker.log';
    this.options = options;
    
    options.verbose >= 3 && console.debug('050: constructing LogfileConsole', this._filepath, options);
    
    this._getLogFile();
    
    // on SIGHUP, close the output stream and open a new one
    process.on('SIGHUP', () => {
      this._getLogFile(true);
    });

    ['debug','error','info','log','warn'].forEach(level => {
      console[level] = (...args) => this._log(level, ...args);
    });
  },

  /**
   *  Return a handle to the WritableStream for this logger, creating one if
   *  necessary.
   *
   *  @param  {boolean} forceNew If truthy, close any existing stream and open
   *                             a new one
   *  @return {fs.WriteStream}
   */
  _getLogFile(forceNew = false) {
    const fs = require('fs');
    
    if (this._file)
    {
      if (!forceNew)
        return this._file;

      try
      {
        this._file.end();
      }
      catch (err)
      {
        console.error('061: failed to close old log file:', err);
      }
      this._file = false;
    }
    
    const options = {
      flags: this.options.truncate ? 'w' : 'a',  // NYI: cli --truncate 
    }
    
    const file = this._file = fs.createWriteStream(this._filepath, options);
    
    // On error, close & recreate the log file
    file.on('error', err => {
      _console.error('082: console-patch::LogFileConsole write error:', err);
      
      this._getLogFile(true);
    });
    
    return file;
  },
  
  /** Write a log line to the output file. Items will be converted to strings as
   *  possible and concatenated after the log-level and timestamp, then written to the
   *  current outputStream.
   *  @param {string} level Log level.
   *  @param {any} ...items Items to log.
   */
  _log(level = 'none', ...items) {
    const strBuilder = [
      (new Date()).toISOString(),
      level,
    ];
    
    items.forEach(i => {
      try {
        switch (typeof i) {
          case 'object':
            strBuilder.push(JSON.stringify(i));
          default:
            strBuilder.push(String(i));
        }
      }
      catch (e) {
        if (e instanceof TypeError) {
          strBuilder.push('[encoding error: ' + e.message + ']');
        }
      }
    });
    
    try {
      this._file.write(strBuilder.join(' ') + '\n');
    }
    catch (error) {
      _console.error('131: Unexpected error writing to log file:', error);
    }
  },
};

Object.assign(exports, consoleLogger, logfileLogger);
