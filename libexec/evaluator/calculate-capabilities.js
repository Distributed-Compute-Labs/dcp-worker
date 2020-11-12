/**
 *  @file       worker/evaluator-lib/calculate-capabilities.js
 *              Copyright (c) 2018, Kings Distributed Systems, Ltd.  All Rights Reserved.
 *
 *              This file provides a message handler for handling capabilities requests.
 *
 *  @author     Ryan Rossiter, ryan@kingsds.network
 *  @date       Sept 2020
 */

/* global WebGPUWindow GPU */
// @ts-nocheck

self.wrapScriptLoading(
  { scriptName: 'calculate-capabilities' },
  (ring2PostMessage) => {
    async function getCapabilities() {
      let offscreenCanvas = false;
      let webgpu = false;
      let bigTexture4096 = false;
      let bigTexture8192 = false;
      let bigTexture16384 = false;
      let bigTexture32768 = false;
      const es7 = false;
      const spidermonkey = false;

      let fdlibmFlag = true;
      const inputFdlibm = [
        7.330382858376182753090688493103,
        9.424777960769379347993890405633,
        14.660765716752370835251895186957,
        16.755160819145565653798257699236,
        7.33038285837618,
      ];

      const outputFdlibm = [
        1525.965888988748247356852516531944,
        12391.64780791669181780889630317688,
        2328571.89435723237693309783935546875,
        18909231.8632431328296661376953125,
        1525.965888988744154630694538354874,
      ];

      webgpu =
        typeof GPU !== 'undefined' ||
        (typeof navigator !== 'undefined' &&
          typeof navigator.gpu !== 'undefined');

      if (webgpu) {
        try {
          // if we're in a standalone, we need to initialize a window before requesting adapter
          // These symbols will have to be updated as the webGPU spec keeps updating and as we update our evaluator
          if (typeof WebGPUWindow !== 'undefined') {
            const gpuWindow = new WebGPUWindow({
              width: 640,
              height: 480,
              title: 'DCP-evaluator',
              visible: false,
            });

            const adapter = await GPU.requestAdapter({ gpuWindow });
            await adapter.requestDevice(adapter.extensions);
          } else {
            const adapter = await navigator.gpu.requestAdapter();
            await adapter.requestDevice();
          }
        } catch (err) {
          // if glfw fails or the symbols exist but webgpu hasn't been
          // properly enabled (mozilla)
          webgpu = false;
        }
      }

      offscreenCanvas = !!(
        typeof OffscreenCanvas !== 'undefined' && new OffscreenCanvas(1, 1)
      );

      if (offscreenCanvas) {
        const canvas = new OffscreenCanvas(1, 1);
        const gl = canvas.getContext('webgl');
        const textureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        // Destroy the WebGL context, from https://www.khronos.org/registry/webgl/extensions/WEBGL_lose_context/
        // "This is the recommended mechanism for applications to programmatically halt their use of the WebGL API."
        gl.getExtension('WEBGL_lose_context').loseContext();

        bigTexture4096 = textureSize >= 4096;
        bigTexture8192 = textureSize >= 8192;
        bigTexture16384 = textureSize >= 16384;
        bigTexture32768 = textureSize >= 32768;
      }

      try {
        for (let i = 0; i < inputFdlibm.length; i++) {
          if (
            Math.exp(inputFdlibm[i]).toFixed(30) !== outputFdlibm[i].toFixed(30)
          ) {
            fdlibmFlag = false;
            break;
          }
        }
      } catch (err) {
        fdlibmFlag = false;
      }

      return {
        engine: {
          es7,
          spidermonkey,
        },
        environment: {
          webgpu,
          offscreenCanvas,
          fdlibm: fdlibmFlag,
        },
        details: {
          offscreenCanvas: {
            bigTexture4096,
            bigTexture8192,
            bigTexture16384,
            bigTexture32768,
          },
        },
      };
    }

    addEventListener('message', async (event) => {
      try {
        if (event.data.request === 'describe') {
          const capabilities = await getCapabilities();
          ring2PostMessage({
            capabilities,
            request: 'describe',
          });
        }
      } catch (error) {
        ring2PostMessage({
          request: 'error',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });
      }
    });
  },
);
