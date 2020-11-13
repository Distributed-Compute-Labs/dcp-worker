/**
 *  @file       dcp/evaluator/environment/webgpu-worker-environment.js
 *  @author     Dominic Cerisano, dcerisano@kingsds.network
 *  @date       May 2020
 */

//web-worker-environment.js must be included before this environment on the command line.

self.wrapScriptLoading({ scriptName: 'webgpu-evaluator' }, (postMessage)=>{  
  if (typeof GPU !== 'undefined'){
    try{
      GPU.$setPlatform("linux");
      {
        let devices = [];
      
        //Timeouts for polyfills
        //Negative numbers to signal clamping override in evaluator engine.
        //nextTickTimeout is for process.nextTick() polyfill
        //immediateTimeout is for setImmediate() polyfill
      
        self.nextTickTimeout  = -0;
        self.immediateTimeout = -0;
      
        function deviceTick()
        {
          for (let ii = 0; ii < self.devices.length; ++ii) {
            /*if (!device.isDestroyed) */
            self.devices[ii].tick();
          };      
        }
      
        self.setTimeout(deviceTick, self.nextTickTimeout);
      
        GPUAdapter.prototype.requestDevice = function() {
          let args = arguments;
        
          return new Promise((resolve, reject) => {
            this._requestDevice(...args).then(device => {
              device._onErrorCallback = function(type, msg) {
                //Polyfill for process.nextTick
                self.setTimeout(() => {
                  switch (type) {
                  case "Error": throw new Error(msg); break;
                  case "Type": throw new TypeError(msg); break;
                  case "Range": throw new RangeError(msg); break;
                  case "Reference": throw new ReferenceError(msg); break;
                  case "Internal": throw new InternalError(msg); break;
                  case "Syntax": throw new SyntaxError(msg); break;
                  default: throw new Error(msg); break;
                  };
                }, self.immediateTimeout);
              };
          
              devices.push(device);
              resolve(device);
            });
          });
        };
      }
      
      
      
      //Return a promise instead of a callback
      
      {
        GPUFence.prototype.onCompletion = function(completionValue) {
          return new Promise(resolve => {
            //Polyfill for setImmediate
            self.setTimeout(() => {
              this._onCompletion(completionValue, resolve);
            }, self.immediateTimeout);
          });
        };
      }
      
      {
        GPUBuffer.prototype.mapReadAsync = function() {
          return new Promise(resolve => {
            //Polyfill for setImmediate
            self.setTimeout(() => {
              this._mapReadAsync(resolve);
            }, self.immediateTimeout);
          });
        };
      }
      
      {
        GPUBuffer.prototype.mapWriteAsync = function() {
          return new Promise(resolve => {
            //Polyfill for setImmediate
            self.setTimeout(() => {
              this._mapWriteAsync(resolve);
            }, self.immediateTimeout);
          });
        };
      }
      
      {
        GPUDevice.prototype.createBufferMappedAsync = function(descriptor) {
          return new Promise(resolve => {
            //Polyfill for setImmediate
            self.setTimeout(() => {
              this._createBufferMappedAsync(descriptor, resolve);
            }, self.immediateTimeout);
          });
        };
      }
      
      
      
      {
        GPUDevice.prototype.createBufferMapped = function(descriptor) {
          return new Promise(resolve => {
            //Polyfill for setImmediate
            self.setTimeout(() => { 
              this._createBufferMapped(descriptor, resolve); 
            }, self.immediateTimeout);
          });
        };
      }

    
    }catch(err){
      console.log("ERROR: ", err);
    }

  };
});
