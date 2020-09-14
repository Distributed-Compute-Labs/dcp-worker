/**
 *  @file       worker/evaluator-lib/access-lists.js
 *
 *              This file applies access lists and polyfills to the global object.
 *
 *  @author     Sam Cantor, sam@kingsds.network
 *  @date       Sept 2020
 */

self.wrapScriptLoading({ scriptName: 'access-lists', ringTransition: true }, (ring0PostMessage) => {
  const ring1PostMessage = self.postMessage;

  // aggregated from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects#Reflection
  var whitelist = new Set([
    '__proto__',
    '_console',
    'addEventListener',
    'applyWhitelist',
    'Array',
    'ArrayBuffer',
    'AsyncFunction',
    'Atomics',
    'Boolean',
    'Blob',
    'bravojs',
    'clearInterval',
    'clearTimeout',
    'console',
    'constructor',
    'dcpConfig',
    'DataView',
    'Date',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'Error',
    'escape',
    'eval',
    'EvalError',
    'File',
    'FileReader',
    'Float32Array',
    'Float64Array',
    'Function',
    'Headers',
    'Infinity',
    'Int16Array',
    'Int32Array',
    'Int8Array',
    'isFinite',
    'isNaN',
    'JSON',
    'Map',
    'Math',
    'module',
    'NaN',
    'navigator',
    'null',
    'Number',
    'Object',
    'OffscreenCanvas',
    'onerror',
    'onmessage',
    'parseFloat',
    'parseInt',
    'performance',
    'postMessage',
    'Promise',
    'propertyIsEnumerable',
    'Proxy',
    'RangeError',
    'ReferenceError',
    'RegExp',
    'removeEventListener',
    'requestAnimationFrame',
    'require',
    'Response',
    'self',
    'Set',
    'setInterval',
    'setTimeout',
    'sleep',
    'String',
    'Symbol',
    'SyntaxError',
    'TextDecoder',
    'TextEncoder',
    'toLocaleString',
    'toString',
    'TypeError',
    'URIError',
    'URL',
    'Uint16Array',
    'Uint32Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'undefined',
    'unescape',
    'valueOf',
    'WeakMap',
    'WeakSet',
    'WebAssembly',
    'WebGL2RenderingContext',
    'WebGLTexture',
    'WorkerGlobalScope',

    // Our own symbols
    'progress',
    'work',
    'flushLastLog'
  ]);

  // Add polyfills for any non-whitelisted symbols
  var polyfills = {
    location: {
      search: ""
    },
    performance: {
      now: Date.now
    },
    importScripts: function () {
      throw new Error('importScripts is not supported on DCP');
    },
    WorkerGlobalScope: typeof globalThis === 'undefined' ? self : globalThis,
    globalThis: typeof globalThis === 'undefined' ? self : globalThis,
    // For browsers/SA-workers that don't support btoa/atob, modified from https://github.com/MaxArt2501/base64-js/blob/master/base64.js
    btoa: function (string) {
      var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

      string = String(string);
      var bitmap, a, b, c,
        result = "", i = 0,
        rest = string.length % 3;

      for (; i < string.length;) {
        if ((a = string.charCodeAt(i++)) > 255
          || (b = string.charCodeAt(i++)) > 255
          || (c = string.charCodeAt(i++)) > 255)
          throw new TypeError("Failed to execute 'btoa': The string to be encoded contains characters outside of the Latin1 range.");

        bitmap = (a << 16) | (b << 8) | c;
        result += b64.charAt(bitmap >> 18 & 63) + b64.charAt(bitmap >> 12 & 63)
          + b64.charAt(bitmap >> 6 & 63) + b64.charAt(bitmap & 63);
      }

      // If there's need of padding, replace the last 'A's with equal signs
      return rest ? result.slice(0, rest - 3) + "===".substring(rest) : result;
    },
    atob: function (string) {
      var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      string = String(string).replace(/[\t\n\f\r ]+/g, "");

      // Adding the padding if missing, for semplicity
      string += "==".slice(2 - (string.length & 3));
      var bitmap, result = "", r1, r2, i = 0;
      for (; i < string.length;) {
        bitmap = b64.indexOf(string.charAt(i++)) << 18 | b64.indexOf(string.charAt(i++)) << 12
          | (r1 = b64.indexOf(string.charAt(i++))) << 6 | (r2 = b64.indexOf(string.charAt(i++)));

        result += r1 === 64 ? String.fromCharCode(bitmap >> 16 & 255)
          : r2 === 64 ? String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255)
            : String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255, bitmap & 255);
      }
      return result;
    }
  };

  // Polyfill for TextEncoder/Decoder
  if (typeof TextEncoder === "undefined") {
    self.TextEncoder = function TextEncoder() { };
    TextEncoder.prototype.encode = function encode(str) {
      "use strict";
      var Len = str.length, resPos = -1;
      // The Uint8Array's length must be at least 3x the length of the string because an invalid UTF-16
      //  takes up the equivelent space of 3 UTF-8 characters to encode it properly. However, Array's
      //  have an auto expanding length and 1.5x should be just the right balance for most uses.
      var resArr = typeof Uint8Array === "undefined" ? new Array(Len * 1.5) : new Uint8Array(Len * 3);
      for (var point = 0, nextcode = 0, i = 0; i !== Len;) {
        point = str.charCodeAt(i), i += 1;
        if (point >= 0xD800 && point <= 0xDBFF) {
          if (i === Len) {
            resArr[resPos += 1] = 0xef/*0b11101111*/; resArr[resPos += 1] = 0xbf/*0b10111111*/;
            resArr[resPos += 1] = 0xbd/*0b10111101*/; break;
          }
          nextcode = str.charCodeAt(i);
          if (nextcode >= 0xDC00 && nextcode <= 0xDFFF) {
            point = (point - 0xD800) * 0x400 + nextcode - 0xDC00 + 0x10000;
            i += 1;
            if (point > 0xffff) {
              resArr[resPos += 1] = (0x1e/*0b11110*/ << 3) | (point >>> 18);
              resArr[resPos += 1] = (0x2/*0b10*/ << 6) | ((point >>> 12) & 0x3f/*0b00111111*/);
              resArr[resPos += 1] = (0x2/*0b10*/ << 6) | ((point >>> 6) & 0x3f/*0b00111111*/);
              resArr[resPos += 1] = (0x2/*0b10*/ << 6) | (point & 0x3f/*0b00111111*/);
              continue;
            }
          } else {
            resArr[resPos += 1] = 0xef/*0b11101111*/; resArr[resPos += 1] = 0xbf/*0b10111111*/;
            resArr[resPos += 1] = 0xbd/*0b10111101*/; continue;
          }
        }
        if (point <= 0x007f) {
          resArr[resPos += 1] = (0x0/*0b0*/ << 7) | point;
        } else if (point <= 0x07ff) {
          resArr[resPos += 1] = (0x6/*0b110*/ << 5) | (point >>> 6);
          resArr[resPos += 1] = (0x2/*0b10*/ << 6) | (point & 0x3f/*0b00111111*/);
        } else {
          resArr[resPos += 1] = (0xe/*0b1110*/ << 4) | (point >>> 12);
          resArr[resPos += 1] = (0x2/*0b10*/ << 6) | ((point >>> 6) & 0x3f/*0b00111111*/);
          resArr[resPos += 1] = (0x2/*0b10*/ << 6) | (point & 0x3f/*0b00111111*/);
        }
      }
      if (typeof Uint8Array !== "undefined") return resArr.subarray(0, resPos + 1);
      // else // IE 6-9
      resArr.length = resPos + 1; // trim off extra weight
      return resArr;
    };
    TextEncoder.prototype.toString = function () { return "[object TextEncoder]"; };
    try { // Object.defineProperty only works on DOM prototypes in IE8
      Object.defineProperty(TextEncoder.prototype, "encoding", {
        get: function () {
          if (TextEncoder.prototype.isPrototypeOf(this)) return "utf-8";
          else throw TypeError("Illegal invocation");
        }
      });
    } catch (e) { /*IE6-8 fallback*/ TextEncoder.prototype.encoding = "utf-8"; }
    if (typeof Symbol !== "undefined") TextEncoder.prototype[Symbol.toStringTag] = "TextEncoder";
  }
  if (typeof TextDecoder === "undefined") {
    self.TextDecoder = function TextDecoder() { };
    TextDecoder.prototype.decode = function (inputArrayOrBuffer) {
      var NativeUint8Array = self.Uint8Array;
      var patchedU8Array = NativeUint8Array || Array;
      var nativeArrayBuffer = NativeUint8Array ? ArrayBuffer : patchedU8Array;
      var tmpBufferU16 = new (NativeUint8Array ? Uint16Array : patchedU8Array)(32);
      var arrayBuffer_isView = nativeArrayBuffer.isView || function (x) { return x && "length" in x; };
      // Check type of input
      var inputAs8 = inputArrayOrBuffer, asObjectString;
      if (!arrayBuffer_isView(inputAs8)) {
        asObjectString = Object_prototype_toString.call(inputAs8);
        if (asObjectString !== arrayBufferString && asObjectString !== sharedArrayBufferString && asObjectString !== undefinedObjectString)
          throw TypeError("Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
        inputAs8 = NativeUint8Array ? new patchedU8Array(inputAs8) : inputAs8 || [];
      }

      var resultingString = "", tmpStr = "", index = 0, len = inputAs8.length | 0, lenMinus32 = len - 32 | 0, nextEnd = 0, nextStop = 0, cp0 = 0, codePoint = 0, minBits = 0, cp1 = 0, pos = 0, tmp = -1;
      // Note that tmp represents the 2nd half of a surrogate pair incase a surrogate gets divided between blocks
      for (; index < len;) {
        nextEnd = index <= lenMinus32 ? 32 : len - index | 0;
        for (; pos < nextEnd; index = index + 1 | 0, pos = pos + 1 | 0) {
          cp0 = inputAs8[index] & 0xff;
          switch (cp0 >> 4) {
            case 15:
              cp1 = inputAs8[index = index + 1 | 0] & 0xff;
              if ((cp1 >> 6) !== 0b10 || 0b11110111 < cp0) {
                index = index - 1 | 0;
                break;
              }
              codePoint = ((cp0 & 0b111) << 6) | (cp1 & 0b00111111);
              minBits = 5; // 20 ensures it never passes -> all invalid replacements
              cp0 = 0x100; //  keep track of th bit size
            case 14:
              cp1 = inputAs8[index = index + 1 | 0] & 0xff;
              codePoint <<= 6;
              codePoint |= ((cp0 & 0b1111) << 6) | (cp1 & 0b00111111);
              minBits = (cp1 >> 6) === 0b10 ? minBits + 4 | 0 : 24; // 24 ensures it never passes -> all invalid replacements
              cp0 = (cp0 + 0x100) & 0x300; // keep track of th bit size
            case 13:
            case 12:
              cp1 = inputAs8[index = index + 1 | 0] & 0xff;
              codePoint <<= 6;
              codePoint |= ((cp0 & 0b11111) << 6) | cp1 & 0b00111111;
              minBits = minBits + 7 | 0;

              // Now, process the code point
              if (index < len && (cp1 >> 6) === 0b10 && (codePoint >> minBits) && codePoint < 0x110000) {
                cp0 = codePoint;
                codePoint = codePoint - 0x10000 | 0;
                if (0 <= codePoint/*0xffff < codePoint*/) { // BMP code point
                  //nextEnd = nextEnd - 1|0;

                  tmp = (codePoint >> 10) + 0xD800 | 0;   // highSurrogate
                  cp0 = (codePoint & 0x3ff) + 0xDC00 | 0; // lowSurrogate (will be inserted later in the switch-statement)

                  if (pos < 31) { // notice 31 instead of 32
                    tmpBufferU16[pos] = tmp;
                    pos = pos + 1 | 0;
                    tmp = -1;
                  } else {// else, we are at the end of the inputAs8 and let tmp0 be filled in later on
                    // NOTE that cp1 is being used as a temporary variable for the swapping of tmp with cp0
                    cp1 = tmp;
                    tmp = cp0;
                    cp0 = cp1;
                  }
                } else nextEnd = nextEnd + 1 | 0; // because we are advancing i without advancing pos
              } else {
                // invalid code point means replacing the whole thing with null replacement characters
                cp0 >>= 8;
                index = index - cp0 - 1 | 0; // reset index  back to what it was before
                cp0 = 0xfffd;
              }


              // Finally, reset the variables for the next go-around
              minBits = 0;
              codePoint = 0;
              nextEnd = index <= lenMinus32 ? 32 : len - index | 0;
            default:
              tmpBufferU16[pos] = cp0; // fill with invalid replacement character
              continue;
            case 11:
            case 10:
            case 9:
            case 8:
          }
          tmpBufferU16[pos] = 0xfffd; // fill with invalid replacement character
        }
        tmpStr += String.fromCharCode(
          tmpBufferU16[0], tmpBufferU16[1], tmpBufferU16[2], tmpBufferU16[3], tmpBufferU16[4], tmpBufferU16[5], tmpBufferU16[6], tmpBufferU16[7],
          tmpBufferU16[8], tmpBufferU16[9], tmpBufferU16[10], tmpBufferU16[11], tmpBufferU16[12], tmpBufferU16[13], tmpBufferU16[14], tmpBufferU16[15],
          tmpBufferU16[16], tmpBufferU16[17], tmpBufferU16[18], tmpBufferU16[19], tmpBufferU16[20], tmpBufferU16[21], tmpBufferU16[22], tmpBufferU16[23],
          tmpBufferU16[24], tmpBufferU16[25], tmpBufferU16[26], tmpBufferU16[27], tmpBufferU16[28], tmpBufferU16[29], tmpBufferU16[30], tmpBufferU16[31]
        );
        if (pos < 32) tmpStr = tmpStr.slice(0, pos - 32 | 0);//-(32-pos));
        if (index < len) {
          //String.fromCharCode.apply(0, tmpBufferU16 : NativeUint8Array ?  tmpBufferU16.subarray(0,pos) : tmpBufferU16.slice(0,pos));
          tmpBufferU16[0] = tmp;
          pos = (~tmp) >>> 31;//tmp !== -1 ? 1 : 0;
          tmp = -1;

          if (tmpStr.length < resultingString.length) continue;
        } else if (tmp !== -1) {
          tmpStr += String.fromCharCode(tmp);
        }

        resultingString += tmpStr;
        tmpStr = "";
      }

      return resultingString;
    };
  }


  // Set values to true to disallow access to symbols
  var blacklist = {
    OffscreenCanvas: false,
  };

  const blacklistRequirements = {
    OffscreenCanvas: "environment.offscreenCanvas"
  };

  /**
   * Applies a whitelist and a blacklist of properties to an object. After this function, if someone tries
   * to access non-whitelisted or blacklisted properties, a warning is logged and it will return undefined.
   *
   * @param {object} obj - The object, which will have the whitelist applied to its properties.
   * @param {Set} whitelist - A set of properties to allow people to access.
   * @param {Set} blacklist - An object of property names mapping to booleans to indicate whether access is allowed or not.
   * @param {Set} blacklistRequirements - An object of property names mapping requirement path strings, used to print useful warnings.
   * @param {Set} polyfills - An object of property names that have been polyfilled.
   */
  function applyAccessLists(obj, whitelist, blacklist = {}, blacklistRequirements = {}, polyfills = {}) {
    if (!obj) { return; }
    Object.getOwnPropertyNames(obj).forEach(function (prop) {
      if (Object.getOwnPropertyDescriptor(obj, prop).configurable) {
        if (!whitelist.has(prop)) {
          let isSet = false;
          let propValue;
          Object.defineProperty(obj, prop, {
            get: function () {
              if (isSet) {
                return propValue;
              } else {
                if (prop in polyfills) {
                  return polyfills[prop];
                }
                return undefined;
              }
            },
            set: function (value) {
              propValue = value;
              isSet = true;
            },
            configurable: false
          });
        } else if (prop in blacklist) {
          let isSet = false;
          let blacklisted = blacklist[prop];
          let requirement = blacklistRequirements[prop];
          let propValue = obj[prop];
          Object.defineProperty(obj, prop, {
            get: function () {
              if (blacklisted && !isSet) {
                return undefined;
              } else {
                return propValue;
              }
            },
            set: function (value) {
              propValue = value;
              isSet = true;
            },
            configurable: false
          });
        }
      }

    });
  }

  /**
   * Applies a list of polyfills to symbols not present in the global object
   * 
   * @param {Object} obj - The global object to add properties on
   * @param {Set} polyfills - An object of property names to create/polyfill 
   */
  function applyPolyfills(obj, polyfills = {}) {
    // Apply symbols from polyfill object
    for (prop in polyfills) {
      let found = false;
      for (let o = obj; o.__proto__ && (o.__proto__ !== Object); o = o.__proto__) {
        if (o.hasOwnProperty(prop)) {
          found = true;
          break;
        }
      }
      if (found) { continue; }
      let propValue = polyfills[prop];
      Object.defineProperty(obj, prop, {
        get: function () {
          return propValue;

        },
        set: function (value) {
          propValue = value;
        },
        configurable: false
      });
    }
  }

  /**
   * Applies the whitelist and blacklist to all global scopes.
   * This must be called after the requirements are assigned to the sandbox
   * so that the blacklist is accessible to modify w/o adding it to the whitelist.
   */
  function applyAllAccessLists() {
    // We need to apply the access lists to global, global.__proto__, and global.__proto__.__proto__,
    // because there's networking-accessing functions inside global.__proto__.__proto__, like fetch.
    //
    // If we're in a robust environment (node, browser, WebWorker, basically anything but v8),
    // then we have to climb the prototype chain and apply the whitelist there, but we have to stop
    // before we whitelist Object's properties

    var global = typeof globalThis === 'undefined' ? self : globalThis;
    // Save them in scope because they'll get hidden by the whitelist
    let _whitelist = whitelist;
    let _blacklist = blacklist;
    let _polyfills = polyfills;
    let _blacklistRequirements = blacklistRequirements;
    let _applyAccessLists = applyAccessLists;
    let _applyPolyfills = applyPolyfills;
    for (let g = global; g.__proto__ && (g.__proto__ !== Object); g = g.__proto__) {
      _applyAccessLists(g, _whitelist, _blacklist, _blacklistRequirements, _polyfills);
    }

    if (typeof navigator === 'undefined') {
      navigator = {
        userAgent: 'not a browser',
        gpu: typeof GPU !== 'undefined' ? GPU : undefined
      };
    } else {
      // We also want to whitelist certain parts of navigator, but not others.
      navWhitelist = new Set(['userAgent']);
      let navPolyfill = {
        gpu: typeof GPU !== 'undefined' ? GPU : undefined
      };
      _applyAccessLists(navigator.__proto__, navWhitelist, {}, {}, navPolyfill);
      _applyPolyfills(navigator.__proto__, navPolyfill);
    }

    // Define properties for symbols that are not present in the global object
    _applyPolyfills(global, _polyfills);
  }

  /* --- /Sam's section --- */

  /* Polyfill section of workerBootstrap */

  // At time of writing, Chrome defines requestAnimationFrame inside web workers, but
  // Firefox doesn't.
  if (typeof requestAnimationFrame == 'undefined') {
    var global = typeof globalThis === 'undefined' ? self : globalThis;
    global.requestAnimationFrame = callback => setTimeout(callback, 0);
  }

  if (typeof OffscreenCanvas !== 'undefined') {

    // This deals with Firefox bug 1529995, which causes the tab to crash if fenceSync is called.
    if (navigator.userAgent.indexOf('Firefox') >= 0) {
      new OffscreenCanvas(640, 480).getContext('webgl2').__proto__.fenceSync = null;
      // Note: We can't just do the following, since WebGL2RenderingContext isn't defined
      // in Firefox until the first webgl2 context is created.
      // WebGL2RenderingContext.prototype.fenceSync = undefined
    }

    // Make it so that if getContext throws on a given type of context, return null
    // instead of throwing an exception. This replicates Chrome's behaviour.
    OffscreenCanvas.prototype.oldGetContext = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function getContextPolyfill(type) {
      try {
        return this.oldGetContext(type);
      } catch (e) {
        return null;
      }
    };
  }

  addEventListener('message', async (event) => {
    try {
      if (event.data.request === 'applyRequirements') {
        // This event is fired when the worker is initialized with job requirements,
        // apply restrictions to the environment based on the requirements.
        // Assume the scheduler gave us a nicely-shaped req object.
        const requirements = event.data.requirements;
        blacklist.OffscreenCanvas = !requirements.environment.offscreenCanvas;
        applyAllAccessLists();

        ring1PostMessage({ request: 'applyRequirementsDone' });
      }
    } catch (error) {
      ring1PostMessage({
        request: 'error',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      });
    }
  });
});
