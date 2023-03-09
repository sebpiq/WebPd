var WebPdRuntime = (function (exports) {
  'use strict';

  var _WebPdWorkletProcessorCode = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\nconst FS_CALLBACK_NAMES = [\n    'onReadSoundFile',\n    'onOpenSoundReadStream',\n    'onWriteSoundFile',\n    'onOpenSoundWriteStream',\n    'onSoundStreamData',\n    'onCloseSoundStream',\n];\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\n    constructor() {\n        super();\n        this.port.onmessage = this.onMessage.bind(this);\n        this.settings = {\n            blockSize: null,\n            sampleRate,\n        };\n        this.dspConfigured = false;\n        this.engine = null;\n    }\n    process(inputs, outputs) {\n        const output = outputs[0];\n        const input = inputs[0];\n        if (!this.dspConfigured) {\n            if (!this.engine) {\n                return true;\n            }\n            this.settings.blockSize = output[0].length;\n            this.engine.configure(this.settings.sampleRate, this.settings.blockSize);\n            this.dspConfigured = true;\n        }\n        this.engine.loop(input, output);\n        return true;\n    }\n    onMessage(messageEvent) {\n        const message = messageEvent.data;\n        switch (message.type) {\n            case 'code:WASM':\n                this.setWasm(message.payload.wasmBuffer);\n                break;\n            case 'code:JS':\n                this.setJsCode(message.payload.jsCode);\n                break;\n            case 'inletCaller':\n                this.engine.inletCallers[message.payload.nodeId][message.payload.portletId](message.payload.message);\n                break;\n            case 'fs':\n                const returned = this.engine.fs[message.payload.functionName].apply(null, message.payload.arguments);\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName: message.payload.functionName + '_return',\n                        operationId: message.payload.arguments[0],\n                        returned,\n                    },\n                });\n                break;\n            case 'destroy':\n                this.destroy();\n                break;\n            default:\n                new Error(`unknown message type ${message.type}`);\n        }\n    }\n    // TODO : control for channelCount of wasmModule\n    setWasm(wasmBuffer) {\n        return AssemblyscriptWasmBindings.createEngine(wasmBuffer).then((engine) => {\n            this.setEngine(engine);\n            return engine;\n        });\n    }\n    setJsCode(code) {\n        const engine = new Function(`\n            ${code}\n            return exports\n        `)();\n        this.setEngine(engine);\n    }\n    setEngine(engine) {\n        FS_CALLBACK_NAMES.forEach((functionName) => {\n            ;\n            engine.fs[functionName] = (...args) => {\n                // We don't use transferables, because that would imply reallocating each time new array in the engine.\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName,\n                        arguments: args,\n                    },\n                });\n            };\n        });\n        this.engine = engine;\n        this.dspConfigured = false;\n    }\n    destroy() {\n        this.process = () => false;\n    }\n}\nregisterProcessor('webpd-node', WasmWorkletProcessor);\n";

  var AssemblyscriptWasmBindingsCode = "var AssemblyscriptWasmBindings = (function (exports) {\n    'use strict';\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n\n    const liftString = (wasmExports, pointer) => {\n        if (!pointer)\n            return null;\n        pointer = pointer >>> 0;\n        const end = (pointer +\n            new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\n            1;\n        const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        let start = pointer >>> 1;\n        let string = '';\n        while (end - start > 1024) {\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n        }\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\n    };\n    const lowerString = (wasmExports, value) => {\n        if (value == null)\n            return 0;\n        const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        for (let i = 0; i < length; ++i)\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\n        return pointer;\n    };\n    const readTypedArray = (wasmExports, constructor, pointer) => {\n        if (!pointer)\n            return null;\n        const memoryU32 = new Uint32Array(wasmExports.memory.buffer);\n        return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\n    };\n    const lowerFloatArray = (wasmExports, bitDepth, data) => {\n        const arrayType = getFloatArrayType(bitDepth);\n        const arrayPointer = wasmExports.createFloatArray(data.length);\n        const array = readTypedArray(wasmExports, arrayType, arrayPointer);\n        array.set(data);\n        return { array, arrayPointer };\n    };\n    const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {\n        const arraysPointer = wasmExports.core_createListOfArrays();\n        data.forEach((array) => {\n            const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);\n            wasmExports.core_pushToListOfArrays(arraysPointer, arrayPointer);\n        });\n        return arraysPointer;\n    };\n    const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {\n        const listLength = wasmExports.core_getListOfArraysLength(listOfArraysPointer);\n        const arrays = [];\n        const arrayType = getFloatArrayType(bitDepth);\n        for (let i = 0; i < listLength; i++) {\n            const arrayPointer = wasmExports.core_getListOfArraysElem(listOfArraysPointer, i);\n            arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));\n        }\n        return arrays;\n    };\n\n    const liftMessage = (wasmExports, messagePointer) => {\n        const messageTokenTypesPointer = wasmExports.msg_getTokenTypes(messagePointer);\n        const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);\n        const message = [];\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\n            if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {\n                message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));\n            }\n            else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {\n                const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);\n                message.push(liftString(wasmExports, stringPointer));\n            }\n        });\n        return message;\n    };\n    const lowerMessage = (wasmExports, message) => {\n        const template = message.reduce((template, value) => {\n            if (typeof value === 'number') {\n                template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());\n            }\n            else if (typeof value === 'string') {\n                template.push(wasmExports.MSG_STRING_TOKEN.valueOf());\n                template.push(value.length);\n            }\n            else {\n                throw new Error(`invalid message value ${value}`);\n            }\n            return template;\n        }, []);\n        const templateArrayPointer = wasmExports.msg_createTemplate(template.length);\n        const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);\n        loweredTemplateArray.set(template);\n        const messagePointer = wasmExports.msg_create(templateArrayPointer);\n        message.forEach((value, index) => {\n            if (typeof value === 'number') {\n                wasmExports.msg_writeFloatToken(messagePointer, index, value);\n            }\n            else if (typeof value === 'string') {\n                const stringPointer = lowerString(wasmExports, value);\n                wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);\n            }\n        });\n        return messagePointer;\n    };\n\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\n            env: {\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\n                    const message = liftString(wasmExports, messagePointer);\n                    lineNumber = lineNumber;\n                    columnNumber = columnNumber;\n                    (() => {\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\n                    })();\n                },\n                seed: () => {\n                    return (() => {\n                        return Date.now() * Math.random();\n                    })();\n                },\n                'console.log': (textPointer) => {\n                    console.log(liftString(wasmExports, textPointer));\n                },\n            },\n            ...wasmImports,\n        });\n        const wasmExports = instanceAndModule.instance\n            .exports;\n        return instanceAndModule.instance;\n    };\n\n    const mapObject = (src, func) => {\n        const dest = {};\n        Object.entries(src).forEach(([key, srcValue], i) => {\n            dest[key] = func(srcValue, key, i);\n        });\n        return dest;\n    };\n    const mapArray = (src, func) => {\n        const dest = {};\n        src.forEach((srcValue, i) => {\n            const [key, destValue] = func(srcValue, i);\n            dest[key] = destValue;\n        });\n        return dest;\n    };\n\n    const createEngine = async (wasmBuffer) => {\n        const engine = new AssemblyScriptWasmEngine(wasmBuffer);\n        await engine.initialize();\n        return engine;\n    };\n    class AssemblyScriptWasmEngine {\n        constructor(wasmBuffer) {\n            this.wasmBuffer = wasmBuffer;\n        }\n        async initialize() {\n            this.metadata = await readMetadata(this.wasmBuffer);\n            this.bitDepth = this.metadata.audioSettings.bitDepth;\n            this.arrayType = getFloatArrayType(this.bitDepth);\n            const wasmImports = {\n                ...this._fsImports(),\n                ...this._outletListenersImports(),\n            };\n            const wasmInstance = await instantiateWasmModule(this.wasmBuffer, {\n                input: wasmImports,\n            });\n            this.wasmExports =\n                wasmInstance.exports;\n            this.commons = this._bindCommons();\n            this.fs = this._bindFs();\n            this.inletCallers = this._bindInletCallers();\n            this.outletListeners = this._bindOutletListeners();\n        }\n        configure(sampleRate, blockSize) {\n            this.blockSize = blockSize;\n            this.metadata.audioSettings.blockSize = blockSize;\n            this.metadata.audioSettings.sampleRate = sampleRate;\n            this.wasmExports.configure(sampleRate, blockSize);\n            this._updateWasmInOuts();\n        }\n        loop(input, output) {\n            for (let channel = 0; channel < input.length; channel++) {\n                this.wasmInput.set(input[channel], channel * this.blockSize);\n            }\n            this._updateWasmInOuts();\n            this.wasmExports.loop();\n            this._updateWasmInOuts();\n            for (let channel = 0; channel < output.length; channel++) {\n                output[channel].set(this.wasmOutput.subarray(this.blockSize * channel, this.blockSize * (channel + 1)));\n            }\n        }\n        _updateWasmInOuts() {\n            this.wasmOutput = readTypedArray(this.wasmExports, this.arrayType, this.wasmExports.getOutput());\n            this.wasmInput = readTypedArray(this.wasmExports, this.arrayType, this.wasmExports.getInput());\n        }\n        _bindCommons() {\n            return {\n                getArray: (arrayName) => {\n                    const arrayNamePointer = lowerString(this.wasmExports, arrayName);\n                    const arrayPointer = this.wasmExports.commons_getArray(arrayNamePointer);\n                    return readTypedArray(this.wasmExports, this.arrayType, arrayPointer);\n                },\n                setArray: (arrayName, array) => {\n                    const stringPointer = lowerString(this.wasmExports, arrayName);\n                    const { arrayPointer } = lowerFloatArray(this.wasmExports, this.bitDepth, array);\n                    this.wasmExports.commons_setArray(stringPointer, arrayPointer);\n                    this._updateWasmInOuts();\n                },\n            };\n        }\n        _bindFs() {\n            return {\n                sendReadSoundFileResponse: (operationId, status, sound) => {\n                    let soundPointer = 0;\n                    if (sound) {\n                        soundPointer = lowerListOfFloatArrays(this.wasmExports, this.bitDepth, sound);\n                    }\n                    this.wasmExports.fs_onReadSoundFileResponse(operationId, status, soundPointer);\n                    this._updateWasmInOuts();\n                },\n                sendWriteSoundFileResponse: this.wasmExports.fs_onWriteSoundFileResponse,\n                sendSoundStreamData: (operationId, sound) => {\n                    const soundPointer = lowerListOfFloatArrays(this.wasmExports, this.bitDepth, sound);\n                    const writtenFrameCount = this.wasmExports.fs_onSoundStreamData(operationId, soundPointer);\n                    this._updateWasmInOuts();\n                    return writtenFrameCount;\n                },\n                closeSoundStream: this.wasmExports.fs_onCloseSoundStream,\n                onReadSoundFile: () => undefined,\n                onWriteSoundFile: () => undefined,\n                onOpenSoundReadStream: () => undefined,\n                onOpenSoundWriteStream: () => undefined,\n                onSoundStreamData: () => undefined,\n                onCloseSoundStream: () => undefined,\n            };\n        }\n        _fsImports() {\n            let wasmImports = {\n                i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onReadSoundFile(operationId, url, info);\n                },\n                i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {\n                    const sound = readListOfFloatArrays(this.wasmExports, this.bitDepth, soundPointer);\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onWriteSoundFile(operationId, sound, url, info);\n                },\n                i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this._updateWasmInOuts();\n                    this.fs.onOpenSoundReadStream(operationId, url, info);\n                },\n                i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onOpenSoundWriteStream(operationId, url, info);\n                },\n                i_fs_sendSoundStreamData: (operationId, blockPointer) => {\n                    const block = readListOfFloatArrays(this.wasmExports, this.bitDepth, blockPointer);\n                    this.fs.onSoundStreamData(operationId, block);\n                },\n                i_fs_closeSoundStream: (...args) => this.fs.onCloseSoundStream(...args),\n            };\n            return wasmImports;\n        }\n        _bindInletCallers() {\n            return mapObject(this.metadata.compilation.inletCallerSpecs, (inletIds, nodeId) => mapArray(inletIds, (inletId) => [\n                inletId,\n                (message) => {\n                    const messagePointer = lowerMessage(this.wasmExports, message);\n                    this.wasmExports[this.metadata.compilation.codeVariableNames\n                        .inletCallers[nodeId][inletId]](messagePointer);\n                },\n            ]));\n        }\n        _bindOutletListeners() {\n            return mapObject(this.metadata.compilation.outletListenerSpecs, (outletIds) => mapArray(outletIds, (outletId) => [\n                outletId,\n                {\n                    onMessage: () => undefined,\n                },\n            ]));\n        }\n        _outletListenersImports() {\n            const wasmImports = {};\n            const { codeVariableNames } = this.metadata.compilation;\n            Object.entries(this.metadata.compilation.outletListenerSpecs).forEach(([nodeId, outletIds]) => {\n                outletIds.forEach((outletId) => {\n                    const listenerName = codeVariableNames.outletListeners[nodeId][outletId];\n                    wasmImports[listenerName] = (messagePointer) => {\n                        const message = liftMessage(this.wasmExports, messagePointer);\n                        this.outletListeners[nodeId][outletId].onMessage(message);\n                    };\n                });\n            });\n            return wasmImports;\n        }\n    }\n    const readMetadata = async (wasmBuffer) => {\n        const inputImports = {};\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\n        wasmModule\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: inputImports,\n        });\n        const wasmExports = wasmInstance.exports;\n        const stringPointer = wasmExports.metadata.valueOf();\n        const metadataJSON = liftString(wasmExports, stringPointer);\n        return JSON.parse(metadataJSON);\n    };\n\n    exports.AssemblyScriptWasmEngine = AssemblyScriptWasmEngine;\n    exports.createEngine = createEngine;\n    exports.readMetadata = readMetadata;\n\n    return exports;\n\n})({});\n//# sourceMappingURL=assemblyscript-wasm-bindings.iife.js.map\n";

  var fetchRetry$1 = function (fetch, defaults) {
    defaults = defaults || {};
    if (typeof fetch !== 'function') {
      throw new ArgumentError('fetch must be a function');
    }

    if (typeof defaults !== 'object') {
      throw new ArgumentError('defaults must be an object');
    }

    if (defaults.retries !== undefined && !isPositiveInteger(defaults.retries)) {
      throw new ArgumentError('retries must be a positive integer');
    }

    if (defaults.retryDelay !== undefined && !isPositiveInteger(defaults.retryDelay) && typeof defaults.retryDelay !== 'function') {
      throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');
    }

    if (defaults.retryOn !== undefined && !Array.isArray(defaults.retryOn) && typeof defaults.retryOn !== 'function') {
      throw new ArgumentError('retryOn property expects an array or function');
    }

    var baseDefaults = {
      retries: 3,
      retryDelay: 1000,
      retryOn: [],
    };

    defaults = Object.assign(baseDefaults, defaults);

    return function fetchRetry(input, init) {
      var retries = defaults.retries;
      var retryDelay = defaults.retryDelay;
      var retryOn = defaults.retryOn;

      if (init && init.retries !== undefined) {
        if (isPositiveInteger(init.retries)) {
          retries = init.retries;
        } else {
          throw new ArgumentError('retries must be a positive integer');
        }
      }

      if (init && init.retryDelay !== undefined) {
        if (isPositiveInteger(init.retryDelay) || (typeof init.retryDelay === 'function')) {
          retryDelay = init.retryDelay;
        } else {
          throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');
        }
      }

      if (init && init.retryOn) {
        if (Array.isArray(init.retryOn) || (typeof init.retryOn === 'function')) {
          retryOn = init.retryOn;
        } else {
          throw new ArgumentError('retryOn property expects an array or function');
        }
      }

      // eslint-disable-next-line no-undef
      return new Promise(function (resolve, reject) {
        var wrappedFetch = function (attempt) {
          // As of node 18, this is no longer needed since node comes with native support for fetch:
          /* istanbul ignore next */
          var _input =
            typeof Request !== 'undefined' && input instanceof Request
              ? input.clone()
              : input;
          fetch(_input, init)
            .then(function (response) {
              if (Array.isArray(retryOn) && retryOn.indexOf(response.status) === -1) {
                resolve(response);
              } else if (typeof retryOn === 'function') {
                try {
                  // eslint-disable-next-line no-undef
                  return Promise.resolve(retryOn(attempt, null, response))
                    .then(function (retryOnResponse) {
                      if(retryOnResponse) {
                        retry(attempt, null, response);
                      } else {
                        resolve(response);
                      }
                    }).catch(reject);
                } catch (error) {
                  reject(error);
                }
              } else {
                if (attempt < retries) {
                  retry(attempt, null, response);
                } else {
                  resolve(response);
                }
              }
            })
            .catch(function (error) {
              if (typeof retryOn === 'function') {
                try {
                  // eslint-disable-next-line no-undef
                  Promise.resolve(retryOn(attempt, error, null))
                    .then(function (retryOnResponse) {
                      if(retryOnResponse) {
                        retry(attempt, error, null);
                      } else {
                        reject(error);
                      }
                    })
                    .catch(function(error) {
                      reject(error);
                    });
                } catch(error) {
                  reject(error);
                }
              } else if (attempt < retries) {
                retry(attempt, error, null);
              } else {
                reject(error);
              }
            });
        };

        function retry(attempt, error, response) {
          var delay = (typeof retryDelay === 'function') ?
            retryDelay(attempt, error, response) : retryDelay;
          setTimeout(function () {
            wrappedFetch(++attempt);
          }, delay);
        }

        wrappedFetch(0);
      });
    };
  };

  function isPositiveInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function ArgumentError(message) {
    this.name = 'ArgumentError';
    this.message = message;
  }

  const fetchRetry = fetchRetry$1(fetch);
  const addModule = async (context, processorCode) => {
      const blob = new Blob([processorCode], { type: 'text/javascript' });
      const workletProcessorUrl = URL.createObjectURL(blob);
      return context.audioWorklet.addModule(workletProcessorUrl);
  };
  // TODO : testing
  const fetchFile = async (url) => {
      let response;
      try {
          response = await fetchRetry(url, { retries: 3 });
      }
      catch (err) {
          throw new FileError(response.status, err.toString());
      }
      if (!response.ok) {
          const responseText = await response.text();
          throw new FileError(response.status, responseText);
      }
      return response.arrayBuffer();
  };
  const audioBufferToArray = (audioBuffer) => {
      const sound = [];
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sound.push(audioBuffer.getChannelData(channel));
      }
      return sound;
  };
  // TODO : testing
  const fixSoundChannelCount = (sound, targetChannelCount) => {
      if (sound.length === 0) {
          throw new Error(`Received empty sound`);
      }
      const floatArrayType = sound[0].constructor;
      const frameCount = sound[0].length;
      const fixedSound = sound.slice(0, targetChannelCount);
      while (sound.length < targetChannelCount) {
          fixedSound.push(new floatArrayType(frameCount));
      }
      return fixedSound;
  };
  class FileError extends Error {
      constructor(status, msg) {
          super(`Error ${status} : ${msg}`);
      }
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // Concatenate WorkletProcessor code with the Wasm bindings it needs
  const WebPdWorkletProcessorCode = AssemblyscriptWasmBindingsCode + ';\n' + _WebPdWorkletProcessorCode;
  const registerWebPdWorkletNode = (context) => {
      return addModule(context, WebPdWorkletProcessorCode);
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const FILES = {};
  const STREAMS = {};
  class FakeStream {
      constructor(url, sound) {
          this.url = url;
          this.sound = sound;
          this.frameCount = sound[0].length;
          this.readPosition = 0;
      }
  }
  const read = async (url) => {
      if (FILES[url]) {
          return FILES[url];
      }
      const arrayBuffer = await fetchFile(url);
      return {
          type: 'binary',
          data: arrayBuffer,
      };
  };
  // TODO : testing
  const readSound = async (url, context) => {
      let fakeFile = FILES[url] || (await read(url));
      switch (fakeFile.type) {
          case 'binary':
              const audioBuffer = await context.decodeAudioData(fakeFile.data);
              return audioBufferToArray(audioBuffer);
          case 'sound':
              // We copy the data here o it can be manipulated freely by the host.
              // e.g. if the buffer is sent as transferrable to the node we don't want the original to be transferred.
              return fakeFile.data.map((array) => array.slice());
      }
  };
  const writeSound = async (sound, url) => {
      FILES[url] = {
          type: 'sound',
          data: sound,
      };
  };
  const readStreamSound = async (operationId, url, channelCount, context) => {
      const sound = await readSound(url, context);
      STREAMS[operationId] = new FakeStream(url, fixSoundChannelCount(sound, channelCount));
      return STREAMS[operationId];
  };
  const writeStreamSound = async (operationId, url, channelCount) => {
      const emptySound = [];
      for (let channel = 0; channel < channelCount; channel++) {
          emptySound.push(new Float32Array(0));
      }
      STREAMS[operationId] = new FakeStream(url, emptySound);
      FILES[url] = {
          type: 'sound',
          data: emptySound,
      };
      return STREAMS[operationId];
  };
  const getStream = (operationId) => {
      return STREAMS[operationId];
  };
  const killStream = (operationId) => {
      console.log('KILL STREAM', operationId);
      delete STREAMS[operationId];
  };
  const pullBlock = (stream, frameCount) => {
      const block = stream.sound.map((array) => array.slice(stream.readPosition, stream.readPosition + frameCount));
      stream.readPosition += frameCount;
      return block;
  };
  const pushBlock = (stream, block) => {
      stream.sound = stream.sound.map((channelData, channel) => {
          const concatenated = new Float32Array(channelData.length + block[channel].length);
          concatenated.set(channelData);
          concatenated.set(block[channel], channelData.length);
          return concatenated;
      });
      stream.frameCount = stream.sound[0].length;
      FILES[stream.url].data = stream.sound;
  };
  var fakeFs = {
      writeSound,
      readSound,
      readStreamSound,
      writeStreamSound,
      pullBlock,
      pushBlock,
  };

  var closeSoundStream = async (node, payload) => {
      if (payload.functionName === 'onCloseSoundStream') {
          killStream(payload.arguments[0]);
      }
  };

  const FS_OPERATION_SUCCESS = 0;
  const FS_OPERATION_FAILURE = 1;

  var readSoundFile = async (node, payload) => {
      if (payload.functionName === 'onReadSoundFile') {
          const [operationId, url, [channelCount]] = payload.arguments;
          let operationStatus = FS_OPERATION_SUCCESS;
          let sound = null;
          try {
              sound = await fakeFs.readSound(url, node.context);
          }
          catch (err) {
              operationStatus = FS_OPERATION_FAILURE;
              console.error(err);
          }
          if (sound) {
              sound = fixSoundChannelCount(sound, channelCount);
          }
          node.port.postMessage({
              type: 'fs',
              payload: {
                  functionName: 'sendReadSoundFileResponse',
                  arguments: [operationId, operationStatus, sound],
              },
          }, 
          // Add as transferables to avoid copies between threads
          sound.map((array) => array.buffer));
      }
      else if (payload.functionName === 'sendReadSoundFileResponse_return') ;
  };

  const BUFFER_HIGH = 10 * 44100;
  const BUFFER_LOW = BUFFER_HIGH / 2;
  var readSoundStream = async (node, payload) => {
      if (payload.functionName === 'onOpenSoundReadStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          try {
              await fakeFs.readStreamSound(operationId, url, channelCount, node.context);
          }
          catch (err) {
              console.error(err);
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'closeSoundStream',
                      arguments: [operationId, FS_OPERATION_FAILURE],
                  },
              });
              return;
          }
          streamLoop(node, operationId, 0);
      }
      else if (payload.functionName === 'sendSoundStreamData_return') {
          const stream = getStream(payload.operationId);
          if (!stream) {
              throw new Error(`unknown stream ${payload.operationId}`);
          }
          streamLoop(node, payload.operationId, payload.returned);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          const stream = getStream(payload.operationId);
          if (stream) {
              killStream(payload.operationId);
          }
      }
  };
  const streamLoop = (node, operationId, framesAvailableInEngine) => {
      const sampleRate = node.context.sampleRate;
      const secondsToThreshold = Math.max(framesAvailableInEngine - BUFFER_LOW, 10) / sampleRate;
      const framesToSend = BUFFER_HIGH -
          (framesAvailableInEngine - secondsToThreshold * sampleRate);
      setTimeout(() => {
          const stream = getStream(operationId);
          if (!stream) {
              console.log(`stream ${operationId} was maybe closed`);
              return;
          }
          if (stream.readPosition < stream.frameCount) {
              const block = pullBlock(stream, framesToSend);
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'sendSoundStreamData',
                      arguments: [operationId, block],
                  },
              }, 
              // Add as transferables to avoid copies between threads
              block.map((array) => array.buffer));
          }
          else {
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'closeSoundStream',
                      arguments: [operationId, FS_OPERATION_SUCCESS],
                  },
              });
          }
      }, secondsToThreshold * 1000);
  };

  var writeSoundFile = async (node, payload) => {
      if (payload.functionName === 'onWriteSoundFile') {
          const [operationId, sound, url, [channelCount]] = payload.arguments;
          const fixedSound = fixSoundChannelCount(sound, channelCount);
          await fakeFs.writeSound(fixedSound, url);
          let operationStatus = FS_OPERATION_SUCCESS;
          node.port.postMessage({
              type: 'fs',
              payload: {
                  functionName: 'sendWriteSoundFileResponse',
                  arguments: [operationId, operationStatus],
              },
          });
      }
      else if (payload.functionName === 'sendWriteSoundFileResponse_return') ;
  };

  var writeSoundStream = async (_, payload) => {
      if (payload.functionName === 'onOpenSoundWriteStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          await fakeFs.writeStreamSound(operationId, url, channelCount);
      }
      else if (payload.functionName === 'onSoundStreamData') {
          const [operationId, sound] = payload.arguments;
          const stream = getStream(operationId);
          if (!stream) {
              throw new Error(`unknown stream ${operationId}`);
          }
          pushBlock(stream, sound);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          const stream = getStream(payload.operationId);
          if (stream) {
              killStream(payload.operationId);
          }
      }
  };

  var index = async (node, messageEvent) => {
      const message = messageEvent.data;
      const { payload } = message;
      if (message.type !== 'fs') {
          throw new Error(`Unknown message type from node ${message.type}`);
      }
      if (payload.functionName === 'onReadSoundFile' ||
          payload.functionName === 'sendReadSoundFileResponse_return') {
          readSoundFile(node, payload);
      }
      else if (payload.functionName === 'onOpenSoundReadStream' ||
          payload.functionName === 'sendSoundStreamData_return') {
          readSoundStream(node, payload);
      }
      else if (payload.functionName === 'onWriteSoundFile' ||
          payload.functionName === 'sendWriteSoundFileResponse_return') {
          writeSoundFile(node, payload);
      }
      else if (payload.functionName === 'onOpenSoundWriteStream' ||
          payload.functionName === 'onSoundStreamData') {
          writeSoundStream(node, payload);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          writeSoundStream(node, payload);
          readSoundStream(node, payload);
      }
      else if (payload.functionName === 'onCloseSoundStream') {
          closeSoundStream(node, payload);
      }
      else {
          throw new Error(`Unknown callback ${payload.functionName}`);
      }
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // TODO : manage transferables
  class WebPdWorkletNode extends AudioWorkletNode {
      constructor(context) {
          super(context, 'webpd-node', {
              numberOfOutputs: 1,
              outputChannelCount: [2],
          });
      }
      destroy() {
          this.port.postMessage({
              type: 'destroy',
              payload: {},
          });
      }
  }

  exports.WebPdWorkletNode = WebPdWorkletNode;
  exports.fsWeb = index;
  exports.registerWebPdWorkletNode = registerWebPdWorkletNode;

  return exports;

})({});
