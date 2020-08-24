/** @file       console-patch.js
 *  @author     Eddie Roosenmaallen <eddie@kingsds.network>
 *  @date       August 2020
 *  
 *  This module provides an API to replace the default behaviour of the global
 *  `console` object, as well as a library of alternative loggers.
 */

// Copy the original global console object's properties onto a backup
const _console = Object.assign({}, console);

/** Require a module if it is present (eg. optionalDependency), or return undefined
 *  @param  {string} moduleId Module serlector, as would be passed to require()
 *  @return {object}          exports-object or undefined
 */
function maybeRequire(moduleId) {
  try {
    return require(moduleId);
  }
  catch (error) {
    _console.debug(`018: Module not available: ${moduleId}.`);
    return undefined;
  }
}

const syslog = maybeRequire('syslog-client');
const winEventLog = false; // NYI maybeRequire('windows-eventlog');


/** Apply a new set of behaviours onto the global console object,
 *  optionally removing any previous patches.
 *  @param {object} newConsole The object from which to patch properties
 *  @param {boolean} resetFirst If true (default), reset global console
 *                              to its original properties before applying 
 *                              new patch
 */
function patch(newConsole = false, resetFirst = true) {
  if (resetFirst)
    Object.assign(console, _console);
  
  if (typeof newConsole === 'object')
    return Object.assign(console, newConsole);
  else
    return console; // with its original properties restored
}

/** Example console-replacement which prefixes each console message with its 
 *  severity
 *  @type {Object}
 */
const markedConsole = {
  debug: (...args)  => _console.debug('d:', ...args),
  error: (...args)  => _console.error('e:', ...args),
  info:  (...args)  => _console.info('i:', ...args),
  log:   (...args)  => _console.log('l:', ...args),
  warn:  (...args)  => _console.warn('w:', ...args),
};

/** Example console-replacement which records console messages into a specified
 *  file
 *  @param {string} filepath Path to the log file
 */
class LogfileConsole {
  constructor(filepath, options = LogfileConsoleDefaultOptions) {
    this._filepath = filepath;
    this._options = options;
    
    _console.debug('050: constructing LogfileConsole', filepath, options);
    
    this._getLogFile();
    
    // on SIGHUP, close the output stream and open a new one
    process.on('SIGHUP', () => {
      this._getLogFile(true);
    });
    
    ['debug','error','info','log','warn'].forEach(level => {
      this[level] = (...args) => this._log(level, ...args);
    });
  }
  
  /**
   *  Return a handle to the WritableStream for this logger, creating one if
   *  necessary.
   *
   *  @param  {Boolean} forceNew If truthy, close any existing stream and open
   *                             a new one
   *  @return {fs.WriteStream}
   */
  _getLogFile(forceNew = false) {
    const fs = require('fs');
    
    if (forceNew && this._file) {
      try {
        this._file.end();
      }
      catch (err) {
        _console.error('061: failed to close old log file:', err);
      }
      this._file = false;
    }
    
    const options = {
      flags: this._options.truncate ? 'w' : 'a',
    }
    
    const file = this._file = fs.createWriteStream(this._filepath, options);
    
    // On error, close & recreate the log file
    file.on('error', err => {
      _console.error('082: console-patch::LogFileConsole write error:', err);
      
      this._getLogFile(true);
    });
    
    return file;
  }
  
  /** Write a log line to the output file. Items will be converted to strings as
   *  possible and concatenated after the log-level and timestamp, then written to the
   *  current outputStream.
   *  @param {string} level Log level.
   *  @param {any} ...items Items to log.
   */
  _log(level = 'none', ...items) {
    const strBuilder = [level, (new Date()).toISOString()];
    
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
  }
}

const LogfileConsoleDefaultOptions = {
  truncate: false,
};

/** Syslog console patch. Write log messages to syslog.
 */
class SyslogConsole {
  constructor(target = '127.0.0.1', options = SyslogConsoleDefaultOptions) {
    const path = require('path');

    this._syslog = syslog.createClient(target, options);
    this._processName = path.basename(process.mainModule.filename || process.argv0);
    
    ['debug','error','info','log','warn'].forEach(level => {
      this[level] = (...args) => this._log(level, ...args);
    });
  }
  
  _log(level, ...items) {
    const strBuilder = [`${this._processName}[${process.pid}]:`];
    
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
    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: syslog.Severity.Error,
      warn:  syslog.Severity.Warning,
      log:   syslog.Severity.Notice,
      info:  syslog.Severity.Informational,
      debug: syslog.Severity.Debug,
    }[level];

    this._syslog.log(strBuilder.join(' '), {
      severity,
    }, error => {
      if (error)
        _console.error('168: Unexpected error writing to syslog:', error);
    });
  }
}

const SyslogConsoleDefaultOptions = {};

/** Windows Event Log console patch
 */
class EventLogConsole {
  constructor(source = '') {
    const path = require('path');

    const processName = path.basename(process.mainModule.filename || process.argv0);
    
    this._eventLog = new winEventLog.EventLog(source, logName);
    
    ['debug','error','info','log','warn'].forEach(level => {
      this[level] = (...args) => this._log(level, ...args);
    });
  }
  
  _log(level, ...items) {
    const strBuilder = [`${this._processName}[${process.pid}]:`];
    
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
    
    // Use the string log-level to look up the severity number:
    let severity = {
      error: 'error',
      warn:  'warn',
      log:   'info',
      info:  'info',
      debug: 'info',
    }[level];

    this._syslog.log(severity, strBuilder.join(' '), error => {
      if (error)
        _console.error('255: Unexpected error writing to event log:', error);
    });
  }
}

Object.assign(exports, {
  patch,
  Consoles: {
    markedConsole,
    
    LogfileConsole,
    LogfileConsoleDefaultOptions,
    
    SyslogConsole,
    SyslogConsoleDefaultOptions,
    
    EventLogConsole,
  }
});
