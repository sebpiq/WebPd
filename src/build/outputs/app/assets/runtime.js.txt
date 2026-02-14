var WebPdRuntime = (function (exports) {
  'use strict';

  var WEB_PD_WORKLET_PROCESSOR_CODE = "/*\n * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n *\n * This file is part of WebPd\n * (see https://github.com/sebpiq/WebPd).\n *\n * This program is free software: you can redistribute it and/or modify\n * it under the terms of the GNU Lesser General Public License as published by\n * the Free Software Foundation, either version 3 of the License, or\n * (at your option) any later version.\n *\n * This program is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU Lesser General Public License for more details.\n *\n * You should have received a copy of the GNU Lesser General Public License\n * along with this program. If not, see <http://www.gnu.org/licenses/>.\n */\nconst FS_CALLBACK_NAMES = [\n    'onReadSoundFile',\n    'onOpenSoundReadStream',\n    'onWriteSoundFile',\n    'onOpenSoundWriteStream',\n    'onSoundStreamData',\n    'onCloseSoundStream',\n];\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\n    constructor() {\n        super();\n        this.port.onmessage = this.onMessage.bind(this);\n        this.settings = {\n            blockSize: null,\n            sampleRate,\n        };\n        this.dspConfigured = false;\n        this.engine = null;\n    }\n    process(inputs, outputs) {\n        const output = outputs[0];\n        const input = inputs[0];\n        if (!this.dspConfigured) {\n            if (!this.engine) {\n                return true;\n            }\n            this.settings.blockSize = output[0].length;\n            this.engine.initialize(this.settings.sampleRate, this.settings.blockSize);\n            this.dspConfigured = true;\n        }\n        this.engine.dspLoop(input, output);\n        return true;\n    }\n    onMessage(messageEvent) {\n        const message = messageEvent.data;\n        switch (message.type) {\n            case 'code:WASM':\n                this.setWasm(message.payload.wasmBuffer);\n                break;\n            case 'code:JS':\n                this.setJsCode(message.payload.jsCode);\n                break;\n            case 'io:messageReceiver':\n                this.engine.io.messageReceivers[message.payload.nodeId][message.payload.portletId](message.payload.message);\n                break;\n            case 'fs':\n                const returned = this.engine.globals.fs[message.payload.functionName].apply(null, message.payload.arguments);\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName: message.payload.functionName + '_return',\n                        operationId: message.payload.arguments[0],\n                        returned,\n                    },\n                });\n                break;\n            case 'destroy':\n                this.destroy();\n                break;\n            default:\n                new Error(`unknown message type ${message.type}`);\n        }\n    }\n    // TODO : control for channelCount of wasmModule\n    setWasm(wasmBuffer) {\n        return AssemblyScriptWasmBindings.createEngine(wasmBuffer).then((engine) => this.setEngine(engine));\n    }\n    setJsCode(code) {\n        const engine = JavaScriptBindings.createEngine(code);\n        this.setEngine(engine);\n    }\n    setEngine(engine) {\n        if (engine.globals.fs) {\n            FS_CALLBACK_NAMES.forEach((functionName) => {\n                engine.globals.fs[functionName] = (...args) => {\n                    // We don't use transferables, because that would imply reallocating each time new array in the engine.\n                    this.port.postMessage({\n                        type: 'fs',\n                        payload: {\n                            functionName,\n                            arguments: args,\n                        },\n                    });\n                };\n            });\n        }\n        Object.entries(engine.metadata.settings.io.messageSenders).forEach(([nodeId, portletIds]) => {\n            portletIds.forEach((portletId) => {\n                engine.io.messageSenders[nodeId][portletId] = (message) => {\n                    this.port.postMessage({\n                        type: 'io:messageSender',\n                        payload: {\n                            nodeId,\n                            portletId,\n                            message,\n                        },\n                    });\n                };\n            });\n        });\n        this.engine = engine;\n        this.dspConfigured = false;\n    }\n    destroy() {\n        this.process = () => false;\n    }\n}\nregisterProcessor('webpd-node', WasmWorkletProcessor);\n";

  var ASSEMBLY_SCRIPT_WASM_BINDINGS_CODE = "var AssemblyScriptWasmBindings = (function (exports) {\n    'use strict';\n\n    const _proxyGetHandlerThrowIfKeyUnknown = (target, key, path) => {\n        if (!(key in target)) {\n            if ([\n                'toJSON',\n                'Symbol(Symbol.toStringTag)',\n                'constructor',\n                '$typeof',\n                '$$typeof',\n                '@@__IMMUTABLE_ITERABLE__@@',\n                '@@__IMMUTABLE_RECORD__@@',\n                'then',\n            ].includes(key)) {\n                return true;\n            }\n            throw new Error(`namespace${path ? ` <${path.keys.join('.')}>` : ''} doesn't know key \"${String(key)}\"`);\n        }\n        return false;\n    };\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n    const proxyAsModuleWithBindings = (rawModule, bindings) => new Proxy({}, {\n        get: (_, k) => {\n            if (bindings.hasOwnProperty(k)) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                switch (bindingSpec.type) {\n                    case 'raw':\n                        if (k in rawModule) {\n                            return rawModule[key];\n                        }\n                        else {\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\n                        }\n                    case 'proxy':\n                    case 'callback':\n                        return bindingSpec.value;\n                }\n            }\n            else {\n                return undefined;\n            }\n        },\n        has: function (_, k) {\n            return k in bindings;\n        },\n        set: (_, k, newValue) => {\n            if (bindings.hasOwnProperty(String(k))) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                if (bindingSpec.type === 'callback') {\n                    bindingSpec.value = newValue;\n                }\n                else {\n                    throw new Error(`Binding key ${String(key)} is read-only`);\n                }\n            }\n            else {\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\n            }\n            return true;\n        },\n    });\n    const proxyWithEngineNameMapping = (rawModule, variableNamesIndex) => proxyWithNameMapping(rawModule, {\n        globals: variableNamesIndex.globals,\n        io: variableNamesIndex.io,\n    });\n    const proxyWithNameMapping = (rawModule, variableNamesIndex) => {\n        if (typeof variableNamesIndex === 'string') {\n            return rawModule[variableNamesIndex];\n        }\n        else if (typeof variableNamesIndex === 'object') {\n            return new Proxy(rawModule, {\n                get: (_, k) => {\n                    const key = String(k);\n                    if (key in rawModule) {\n                        return Reflect.get(rawModule, key);\n                    }\n                    else if (key in variableNamesIndex) {\n                        const nextVariableNames = variableNamesIndex[key];\n                        return proxyWithNameMapping(rawModule, nextVariableNames);\n                    }\n                    else if (_proxyGetHandlerThrowIfKeyUnknown(rawModule, key)) {\n                        return undefined;\n                    }\n                },\n                has: function (_, k) {\n                    return k in rawModule || k in variableNamesIndex;\n                },\n                set: (_, k, value) => {\n                    const key = String(k);\n                    if (key in variableNamesIndex) {\n                        const variableName = variableNamesIndex[key];\n                        if (typeof variableName !== 'string') {\n                            throw new Error(`Failed to set value for key ${String(k)}: variable name is not a string`);\n                        }\n                        return Reflect.set(rawModule, variableName, value);\n                    }\n                    else {\n                        throw new Error(`Key ${String(k)} is not defined in raw module`);\n                    }\n                },\n            });\n        }\n        else {\n            throw new Error(`Invalid name mapping`);\n        }\n    };\n\n    const liftString = (rawModule, pointer) => {\n        if (!pointer) {\n            throw new Error('Cannot lift a null pointer');\n        }\n        pointer = pointer >>> 0;\n        const end = (pointer +\n            new Uint32Array(rawModule.memory.buffer)[(pointer - 4) >>> 2]) >>>\n            1;\n        const memoryU16 = new Uint16Array(rawModule.memory.buffer);\n        let start = pointer >>> 1;\n        let string = '';\n        while (end - start > 1024) {\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n        }\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\n    };\n    const lowerString = (rawModule, value) => {\n        if (value == null) {\n            throw new Error('Cannot lower a null string');\n        }\n        const length = value.length, pointer = rawModule.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(rawModule.memory.buffer);\n        for (let i = 0; i < length; ++i)\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\n        return pointer;\n    };\n    const readTypedArray = (rawModule, constructor, pointer) => {\n        if (!pointer) {\n            throw new Error('Cannot lift a null pointer');\n        }\n        const memoryU32 = new Uint32Array(rawModule.memory.buffer);\n        return new constructor(rawModule.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\n    };\n    const lowerFloatArray = (rawModule, bitDepth, data) => {\n        const arrayType = getFloatArrayType(bitDepth);\n        const arrayPointer = rawModule.globals.core.createFloatArray(data.length);\n        const array = readTypedArray(rawModule, arrayType, arrayPointer);\n        array.set(data);\n        return { array, arrayPointer };\n    };\n    const lowerListOfFloatArrays = (rawModule, bitDepth, data) => {\n        const arraysPointer = rawModule.globals.core.x_createListOfArrays();\n        data.forEach((array) => {\n            const { arrayPointer } = lowerFloatArray(rawModule, bitDepth, array);\n            rawModule.globals.core.x_pushToListOfArrays(arraysPointer, arrayPointer);\n        });\n        return arraysPointer;\n    };\n    const readListOfFloatArrays = (rawModule, bitDepth, listOfArraysPointer) => {\n        const listLength = rawModule.globals.core.x_getListOfArraysLength(listOfArraysPointer);\n        const arrays = [];\n        const arrayType = getFloatArrayType(bitDepth);\n        for (let i = 0; i < listLength; i++) {\n            const arrayPointer = rawModule.globals.core.x_getListOfArraysElem(listOfArraysPointer, i);\n            arrays.push(readTypedArray(rawModule, arrayType, arrayPointer));\n        }\n        return arrays;\n    };\n\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\n            env: {\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\n                    const message = liftString(wasmExports, messagePointer);\n                    lineNumber = lineNumber;\n                    columnNumber = columnNumber;\n                    (() => {\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\n                    })();\n                },\n                seed: () => {\n                    return (() => {\n                        return Date.now() * Math.random();\n                    })();\n                },\n                'console.log': (textPointer) => {\n                    console.log(liftString(wasmExports, textPointer));\n                },\n            },\n            ...wasmImports,\n        });\n        const wasmExports = instanceAndModule.instance\n            .exports;\n        return instanceAndModule.instance;\n    };\n\n    const updateWasmInOuts = ({ refs, cache, }) => {\n        cache.wasmOutput = readTypedArray(refs.rawModule, cache.arrayType, refs.rawModule.globals.core.x_getOutput());\n        cache.wasmInput = readTypedArray(refs.rawModule, cache.arrayType, refs.rawModule.globals.core.x_getInput());\n    };\n    const createEngineLifecycleBindings = (engineContext) => {\n        const { refs, cache, metadata } = engineContext;\n        return {\n            initialize: {\n                type: 'proxy',\n                value: (sampleRate, blockSize) => {\n                    metadata.settings.audio.blockSize = blockSize;\n                    metadata.settings.audio.sampleRate = sampleRate;\n                    cache.blockSize = blockSize;\n                    refs.rawModule.initialize(sampleRate, blockSize);\n                    updateWasmInOuts(engineContext);\n                },\n            },\n            dspLoop: {\n                type: 'proxy',\n                value: (input, output) => {\n                    for (let channel = 0; channel < input.length; channel++) {\n                        cache.wasmInput.set(input[channel], channel * cache.blockSize);\n                    }\n                    updateWasmInOuts(engineContext);\n                    refs.rawModule.dspLoop();\n                    updateWasmInOuts(engineContext);\n                    for (let channel = 0; channel < output.length; channel++) {\n                        output[channel].set(cache.wasmOutput.subarray(cache.blockSize * channel, cache.blockSize * (channel + 1)));\n                    }\n                },\n            },\n        };\n    };\n\n    const createCommonsBindings = (engineContext) => {\n        const { refs, cache } = engineContext;\n        return {\n            getArray: {\n                type: 'proxy',\n                value: (arrayName) => {\n                    const arrayNamePointer = lowerString(refs.rawModule, arrayName);\n                    const arrayPointer = refs.rawModule.globals.commons.getArray(arrayNamePointer);\n                    return readTypedArray(refs.rawModule, cache.arrayType, arrayPointer);\n                },\n            },\n            setArray: {\n                type: 'proxy',\n                value: (arrayName, array) => {\n                    const stringPointer = lowerString(refs.rawModule, arrayName);\n                    const { arrayPointer } = lowerFloatArray(refs.rawModule, cache.bitDepth, array);\n                    refs.rawModule.globals.commons.setArray(stringPointer, arrayPointer);\n                    updateWasmInOuts(engineContext);\n                },\n            },\n        };\n    };\n\n    const readMetadata = async (wasmBuffer) => {\n        const inputImports = {};\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\n        wasmModule\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: inputImports,\n        });\n        const rawModule = wasmInstance.exports;\n        const stringPointer = rawModule.metadata.valueOf();\n        const metadataJSON = liftString(rawModule, stringPointer);\n        return JSON.parse(metadataJSON);\n    };\n\n    const mapArray = (src, func) => {\n        const dest = {};\n        src.forEach((srcValue, i) => {\n            const [key, destValue] = func(srcValue, i);\n            dest[key] = destValue;\n        });\n        return dest;\n    };\n\n    const liftMessage = (rawModule, messagePointer) => {\n        const messageTokenTypesPointer = rawModule.globals.msg.x_getTokenTypes(messagePointer);\n        const messageTokenTypes = readTypedArray(rawModule, Int32Array, messageTokenTypesPointer);\n        const message = [];\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\n            if (tokenType === rawModule.globals.msg.FLOAT_TOKEN.valueOf()) {\n                message.push(rawModule.globals.msg.readFloatToken(messagePointer, tokenIndex));\n            }\n            else if (tokenType === rawModule.globals.msg.STRING_TOKEN.valueOf()) {\n                const stringPointer = rawModule.globals.msg.readStringToken(messagePointer, tokenIndex);\n                message.push(liftString(rawModule, stringPointer));\n            }\n        });\n        return message;\n    };\n    const lowerMessage = (rawModule, message) => {\n        const template = message.reduce((template, value) => {\n            if (typeof value === 'number') {\n                template.push(rawModule.globals.msg.FLOAT_TOKEN.valueOf());\n            }\n            else if (typeof value === 'string') {\n                template.push(rawModule.globals.msg.STRING_TOKEN.valueOf());\n                template.push(value.length);\n            }\n            else {\n                throw new Error(`invalid message value ${value}`);\n            }\n            return template;\n        }, []);\n        const templateArrayPointer = rawModule.globals.msg.x_createTemplate(template.length);\n        const loweredTemplateArray = readTypedArray(rawModule, Int32Array, templateArrayPointer);\n        loweredTemplateArray.set(template);\n        const messagePointer = rawModule.globals.msg.x_create(templateArrayPointer);\n        message.forEach((value, index) => {\n            if (typeof value === 'number') {\n                rawModule.globals.msg.writeFloatToken(messagePointer, index, value);\n            }\n            else if (typeof value === 'string') {\n                const stringPointer = lowerString(rawModule, value);\n                rawModule.globals.msg.writeStringToken(messagePointer, index, stringPointer);\n            }\n        });\n        return messagePointer;\n    };\n\n    const createIoMessageReceiversBindings = ({ metadata, refs, }) => Object.entries(metadata.settings.io.messageReceivers).reduce((bindings, [nodeId, spec]) => ({\n        ...bindings,\n        [nodeId]: {\n            type: 'proxy',\n            value: mapArray(spec, (inletId) => [\n                inletId,\n                (message) => {\n                    const messagePointer = lowerMessage(refs.rawModule, message);\n                    refs.rawModule.io.messageReceivers[nodeId][inletId](messagePointer);\n                },\n            ]),\n        },\n    }), {});\n    const createIoMessageSendersBindings = ({ metadata, }) => Object.entries(metadata.settings.io.messageSenders).reduce((bindings, [nodeId, spec]) => ({\n        ...bindings,\n        [nodeId]: {\n            type: 'proxy',\n            value: mapArray(spec, (outletId) => [\n                outletId,\n                (_) => undefined,\n            ]),\n        },\n    }), {});\n    const ioMsgSendersImports = ({ metadata, refs, }) => {\n        const wasmImports = {};\n        const { variableNamesIndex } = metadata.compilation;\n        Object.entries(metadata.settings.io.messageSenders).forEach(([nodeId, spec]) => {\n            spec.forEach((outletId) => {\n                const listenerName = variableNamesIndex.io.messageSenders[nodeId][outletId];\n                wasmImports[listenerName] = (messagePointer) => {\n                    const message = liftMessage(refs.rawModule, messagePointer);\n                    refs.engine.io.messageSenders[nodeId][outletId](message);\n                };\n            });\n        });\n        return wasmImports;\n    };\n\n    const createFsBindings = (engineContext) => {\n        const { refs, cache, metadata } = engineContext;\n        const fsExportedNames = metadata.compilation.variableNamesIndex.globals.fs;\n        return {\n            sendReadSoundFileResponse: {\n                type: 'proxy',\n                value: 'x_onReadSoundFileResponse' in fsExportedNames\n                    ? (operationId, status, sound) => {\n                        let soundPointer = 0;\n                        if (sound) {\n                            soundPointer = lowerListOfFloatArrays(refs.rawModule, cache.bitDepth, sound);\n                        }\n                        refs.rawModule.globals.fs.x_onReadSoundFileResponse(operationId, status, soundPointer);\n                        updateWasmInOuts(engineContext);\n                    }\n                    : undefined,\n            },\n            sendWriteSoundFileResponse: {\n                type: 'proxy',\n                value: 'x_onWriteSoundFileResponse' in fsExportedNames\n                    ? refs.rawModule.globals.fs.x_onWriteSoundFileResponse\n                    : undefined,\n            },\n            sendSoundStreamData: {\n                type: 'proxy',\n                value: 'x_onSoundStreamData' in fsExportedNames\n                    ? (operationId, sound) => {\n                        const soundPointer = lowerListOfFloatArrays(refs.rawModule, cache.bitDepth, sound);\n                        const writtenFrameCount = refs.rawModule.globals.fs.x_onSoundStreamData(operationId, soundPointer);\n                        updateWasmInOuts(engineContext);\n                        return writtenFrameCount;\n                    }\n                    : undefined,\n            },\n            closeSoundStream: {\n                type: 'proxy',\n                value: 'x_onCloseSoundStream' in fsExportedNames\n                    ? refs.rawModule.globals.fs.x_onCloseSoundStream\n                    : undefined,\n            },\n            onReadSoundFile: { type: 'callback', value: () => undefined },\n            onWriteSoundFile: { type: 'callback', value: () => undefined },\n            onOpenSoundReadStream: { type: 'callback', value: () => undefined },\n            onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\n            onSoundStreamData: { type: 'callback', value: () => undefined },\n            onCloseSoundStream: { type: 'callback', value: () => undefined },\n        };\n    };\n    const createFsImports = (engineContext) => {\n        const wasmImports = {};\n        const { cache, metadata, refs } = engineContext;\n        const exportedNames = metadata.compilation.variableNamesIndex.globals;\n        if ('fs' in exportedNames) {\n            const nameMapping = proxyWithNameMapping(wasmImports, exportedNames.fs);\n            if ('i_readSoundFile' in exportedNames.fs) {\n                nameMapping.i_readSoundFile = (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(refs.rawModule, urlPointer);\n                    const info = liftMessage(refs.rawModule, infoPointer);\n                    refs.engine.globals.fs.onReadSoundFile(operationId, url, info);\n                };\n            }\n            if ('i_writeSoundFile' in exportedNames.fs) {\n                nameMapping.i_writeSoundFile = (operationId, soundPointer, urlPointer, infoPointer) => {\n                    const sound = readListOfFloatArrays(refs.rawModule, cache.bitDepth, soundPointer);\n                    const url = liftString(refs.rawModule, urlPointer);\n                    const info = liftMessage(refs.rawModule, infoPointer);\n                    refs.engine.globals.fs.onWriteSoundFile(operationId, sound, url, info);\n                };\n            }\n            if ('i_openSoundReadStream' in exportedNames.fs) {\n                nameMapping.i_openSoundReadStream = (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(refs.rawModule, urlPointer);\n                    const info = liftMessage(refs.rawModule, infoPointer);\n                    updateWasmInOuts(engineContext);\n                    refs.engine.globals.fs.onOpenSoundReadStream(operationId, url, info);\n                };\n            }\n            if ('i_openSoundWriteStream' in exportedNames.fs) {\n                nameMapping.i_openSoundWriteStream = (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(refs.rawModule, urlPointer);\n                    const info = liftMessage(refs.rawModule, infoPointer);\n                    refs.engine.globals.fs.onOpenSoundWriteStream(operationId, url, info);\n                };\n            }\n            if ('i_sendSoundStreamData' in exportedNames.fs) {\n                nameMapping.i_sendSoundStreamData = (operationId, blockPointer) => {\n                    const block = readListOfFloatArrays(refs.rawModule, cache.bitDepth, blockPointer);\n                    refs.engine.globals.fs.onSoundStreamData(operationId, block);\n                };\n            }\n            if ('i_closeSoundStream' in exportedNames.fs) {\n                nameMapping.i_closeSoundStream = (...args) => refs.engine.globals.fs.onCloseSoundStream(...args);\n            }\n        }\n        return wasmImports;\n    };\n\n    const createEngine = async (wasmBuffer, additionalBindings) => {\n        const metadata = await readMetadata(wasmBuffer);\n        const bitDepth = metadata.settings.audio.bitDepth;\n        const arrayType = getFloatArrayType(bitDepth);\n        const engineContext = {\n            refs: {},\n            metadata: metadata,\n            cache: {\n                wasmOutput: new arrayType(0),\n                wasmInput: new arrayType(0),\n                arrayType,\n                bitDepth,\n                blockSize: 0,\n            },\n        };\n        const wasmImports = {\n            ...createFsImports(engineContext),\n            ...ioMsgSendersImports(engineContext),\n        };\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: wasmImports,\n        });\n        engineContext.refs.rawModule = proxyWithEngineNameMapping(wasmInstance.exports, metadata.compilation.variableNamesIndex);\n        const engineBindings = createEngineBindings(engineContext);\n        const engine = proxyAsModuleWithBindings(engineContext.refs.rawModule, {\n            ...engineBindings,\n            ...(additionalBindings || {}),\n        });\n        engineContext.refs.engine = engine;\n        return engine;\n    };\n    const createEngineBindings = (engineContext) => {\n        const { metadata, refs } = engineContext;\n        const exportedNames = metadata.compilation.variableNamesIndex.globals;\n        const io = {\n            messageReceivers: proxyAsModuleWithBindings(refs.rawModule, createIoMessageReceiversBindings(engineContext)),\n            messageSenders: proxyAsModuleWithBindings(refs.rawModule, createIoMessageSendersBindings(engineContext)),\n        };\n        const globalsBindings = {\n            commons: {\n                type: 'proxy',\n                value: proxyAsModuleWithBindings(refs.rawModule, createCommonsBindings(engineContext)),\n            },\n        };\n        if ('fs' in exportedNames) {\n            const fs = proxyAsModuleWithBindings(refs.rawModule, createFsBindings(engineContext));\n            globalsBindings.fs = { type: 'proxy', value: fs };\n        }\n        return {\n            ...createEngineLifecycleBindings(engineContext),\n            metadata: { type: 'proxy', value: metadata },\n            globals: {\n                type: 'proxy',\n                value: proxyAsModuleWithBindings(refs.rawModule, globalsBindings),\n            },\n            io: { type: 'proxy', value: io },\n        };\n    };\n\n    exports.createEngine = createEngine;\n    exports.createEngineBindings = createEngineBindings;\n\n    return exports;\n\n})({});\n";

  var JAVA_SCRIPT_BINDINGS_CODE = "var JavaScriptBindings = (function (exports) {\n    'use strict';\n\n    const _proxyGetHandlerThrowIfKeyUnknown = (target, key, path) => {\n        if (!(key in target)) {\n            if ([\n                'toJSON',\n                'Symbol(Symbol.toStringTag)',\n                'constructor',\n                '$typeof',\n                '$$typeof',\n                '@@__IMMUTABLE_ITERABLE__@@',\n                '@@__IMMUTABLE_RECORD__@@',\n                'then',\n            ].includes(key)) {\n                return true;\n            }\n            throw new Error(`namespace${path ? ` <${path.keys.join('.')}>` : ''} doesn't know key \"${String(key)}\"`);\n        }\n        return false;\n    };\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n    const proxyAsModuleWithBindings = (rawModule, bindings) => new Proxy({}, {\n        get: (_, k) => {\n            if (bindings.hasOwnProperty(k)) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                switch (bindingSpec.type) {\n                    case 'raw':\n                        if (k in rawModule) {\n                            return rawModule[key];\n                        }\n                        else {\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\n                        }\n                    case 'proxy':\n                    case 'callback':\n                        return bindingSpec.value;\n                }\n            }\n            else {\n                return undefined;\n            }\n        },\n        has: function (_, k) {\n            return k in bindings;\n        },\n        set: (_, k, newValue) => {\n            if (bindings.hasOwnProperty(String(k))) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                if (bindingSpec.type === 'callback') {\n                    bindingSpec.value = newValue;\n                }\n                else {\n                    throw new Error(`Binding key ${String(key)} is read-only`);\n                }\n            }\n            else {\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\n            }\n            return true;\n        },\n    });\n    const proxyWithEngineNameMapping = (rawModule, variableNamesIndex) => proxyWithNameMapping(rawModule, {\n        globals: variableNamesIndex.globals,\n        io: variableNamesIndex.io,\n    });\n    const proxyWithNameMapping = (rawModule, variableNamesIndex) => {\n        if (typeof variableNamesIndex === 'string') {\n            return rawModule[variableNamesIndex];\n        }\n        else if (typeof variableNamesIndex === 'object') {\n            return new Proxy(rawModule, {\n                get: (_, k) => {\n                    const key = String(k);\n                    if (key in rawModule) {\n                        return Reflect.get(rawModule, key);\n                    }\n                    else if (key in variableNamesIndex) {\n                        const nextVariableNames = variableNamesIndex[key];\n                        return proxyWithNameMapping(rawModule, nextVariableNames);\n                    }\n                    else if (_proxyGetHandlerThrowIfKeyUnknown(rawModule, key)) {\n                        return undefined;\n                    }\n                },\n                has: function (_, k) {\n                    return k in rawModule || k in variableNamesIndex;\n                },\n                set: (_, k, value) => {\n                    const key = String(k);\n                    if (key in variableNamesIndex) {\n                        const variableName = variableNamesIndex[key];\n                        if (typeof variableName !== 'string') {\n                            throw new Error(`Failed to set value for key ${String(k)}: variable name is not a string`);\n                        }\n                        return Reflect.set(rawModule, variableName, value);\n                    }\n                    else {\n                        throw new Error(`Key ${String(k)} is not defined in raw module`);\n                    }\n                },\n            });\n        }\n        else {\n            throw new Error(`Invalid name mapping`);\n        }\n    };\n\n    const createFsModule = (rawModule) => {\n        const fsExportedNames = rawModule.metadata.compilation.variableNamesIndex.globals.fs;\n        const fs = proxyAsModuleWithBindings(rawModule, {\n            onReadSoundFile: { type: 'callback', value: () => undefined },\n            onWriteSoundFile: { type: 'callback', value: () => undefined },\n            onOpenSoundReadStream: { type: 'callback', value: () => undefined },\n            onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\n            onSoundStreamData: { type: 'callback', value: () => undefined },\n            onCloseSoundStream: { type: 'callback', value: () => undefined },\n            sendReadSoundFileResponse: {\n                type: 'proxy',\n                value: 'x_onReadSoundFileResponse' in fsExportedNames\n                    ? rawModule.globals.fs.x_onReadSoundFileResponse\n                    : undefined,\n            },\n            sendWriteSoundFileResponse: {\n                type: 'proxy',\n                value: 'x_onWriteSoundFileResponse' in fsExportedNames\n                    ? rawModule.globals.fs.x_onWriteSoundFileResponse\n                    : undefined,\n            },\n            sendSoundStreamData: {\n                type: 'proxy',\n                value: 'x_onSoundStreamData' in fsExportedNames\n                    ? rawModule.globals.fs.x_onSoundStreamData\n                    : undefined,\n            },\n            closeSoundStream: {\n                type: 'proxy',\n                value: 'x_onCloseSoundStream' in fsExportedNames\n                    ? rawModule.globals.fs.x_onCloseSoundStream\n                    : undefined,\n            },\n        });\n        if ('i_openSoundWriteStream' in fsExportedNames) {\n            rawModule.globals.fs.i_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);\n        }\n        if ('i_sendSoundStreamData' in fsExportedNames) {\n            rawModule.globals.fs.i_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);\n        }\n        if ('i_openSoundReadStream' in fsExportedNames) {\n            rawModule.globals.fs.i_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);\n        }\n        if ('i_closeSoundStream' in fsExportedNames) {\n            rawModule.globals.fs.i_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);\n        }\n        if ('i_writeSoundFile' in fsExportedNames) {\n            rawModule.globals.fs.i_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);\n        }\n        if ('i_readSoundFile' in fsExportedNames) {\n            rawModule.globals.fs.i_readSoundFile = (...args) => fs.onReadSoundFile(...args);\n        }\n        return fs;\n    };\n\n    const createCommonsModule = (rawModule, metadata) => {\n        const floatArrayType = getFloatArrayType(metadata.settings.audio.bitDepth);\n        return proxyAsModuleWithBindings(rawModule, {\n            getArray: {\n                type: 'proxy',\n                value: (arrayName) => rawModule.globals.commons.getArray(arrayName),\n            },\n            setArray: {\n                type: 'proxy',\n                value: (arrayName, array) => rawModule.globals.commons.setArray(arrayName, new floatArrayType(array)),\n            },\n        });\n    };\n\n    const compileRawModule = (code) => new Function(`\n        ${code}\n        return exports\n    `)();\n    const createEngineBindings = (rawModule) => {\n        const exportedNames = rawModule.metadata.compilation.variableNamesIndex.globals;\n        const globalsBindings = {\n            commons: {\n                type: 'proxy',\n                value: createCommonsModule(rawModule, rawModule.metadata),\n            },\n        };\n        if ('fs' in exportedNames) {\n            globalsBindings.fs = { type: 'proxy', value: createFsModule(rawModule) };\n        }\n        return {\n            metadata: { type: 'raw' },\n            initialize: { type: 'raw' },\n            dspLoop: { type: 'raw' },\n            io: { type: 'raw' },\n            globals: {\n                type: 'proxy',\n                value: proxyAsModuleWithBindings(rawModule, globalsBindings),\n            },\n        };\n    };\n    const createEngine = (code, additionalBindings) => {\n        const rawModule = compileRawModule(code);\n        const rawModuleWithNameMapping = proxyWithEngineNameMapping(rawModule, rawModule.metadata.compilation.variableNamesIndex);\n        return proxyAsModuleWithBindings(rawModule, {\n            ...createEngineBindings(rawModuleWithNameMapping),\n            ...(additionalBindings || {}),\n        });\n    };\n\n    exports.compileRawModule = compileRawModule;\n    exports.createEngine = createEngine;\n    exports.createEngineBindings = createEngineBindings;\n\n    return exports;\n\n})({});\n";

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

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  const fetchRetry = fetchRetry$1(fetch);
  /**
   * Note : the audio worklet feature is available only in secure context.
   * This function will fail when used in insecure context (non-https, etc ...)
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
   */
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
  const resolveRelativeUrl = (rootUrl, relativeUrl) => {
      return new URL(relativeUrl, rootUrl).href;
  };
  class FileError extends Error {
      constructor(status, msg) {
          super(`Error ${status} : ${msg}`);
      }
  }

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
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
  // Concatenate WorkletProcessor code with the Wasm bindings it needs
  const WEBPD_WORKLET_PROCESSOR_CODE = ASSEMBLY_SCRIPT_WASM_BINDINGS_CODE +
      ';\n' +
      JAVA_SCRIPT_BINDINGS_CODE +
      ';\n' +
      WEB_PD_WORKLET_PROCESSOR_CODE;
  const registerWebPdWorkletNode = (context) => {
      return addModule(context, WEBPD_WORKLET_PROCESSOR_CODE);
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
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

  var closeSoundStream = async (_, payload, __) => {
      if (payload.functionName === 'onCloseSoundStream') {
          killStream(payload.arguments[0]);
      }
  };

  const _addPath$1 = (parent, key, _path) => {
      const path = _ensurePath$1(_path);
      return {
          keys: [...path.keys, key],
          parents: [...path.parents, parent],
      };
  };
  const _ensurePath$1 = (path) => path || {
      keys: [],
      parents: [],
  };
  const _proxySetHandlerReadOnly$1 = () => {
      throw new Error('This Proxy is read-only.');
  };
  const _proxyGetHandlerThrowIfKeyUnknown$1 = (target, key, path) => {
      if (!(key in target)) {
          // Whitelist some fields that are undefined but accessed at
          // some point or another by our code.
          // TODO : find a better way to do this.
          if ([
              'toJSON',
              'Symbol(Symbol.toStringTag)',
              'constructor',
              '$typeof',
              '$$typeof',
              '@@__IMMUTABLE_ITERABLE__@@',
              '@@__IMMUTABLE_RECORD__@@',
              'then',
          ].includes(key)) {
              return true;
          }
          throw new Error(`namespace${path ? ` <${path.keys.join('.')}>` : ''} doesn't know key "${String(key)}"`);
      }
      return false;
  };
  const proxyAsAssigner$1 = (spec, _obj, context, _path) => {
      const path = _path || { keys: [], parents: [] };
      const obj = proxyAsAssigner$1.ensureValue(_obj, spec, context, path);
      // If `_path` is provided, assign the new value to the parent object.
      if (_path) {
          const parent = _path.parents[_path.parents.length - 1];
          const key = _path.keys[_path.keys.length - 1];
          // The only case where we want to overwrite the existing value
          // is when it was a `null` assigned by `LiteralDefaultNull`, and
          // we want to set the real value instead.
          if (!(key in parent) || 'LiteralDefaultNull' in spec) {
              parent[key] = obj;
          }
      }
      // If the object is a Literal, end of the recursion.
      if ('Literal' in spec || 'LiteralDefaultNull' in spec) {
          return obj;
      }
      return new Proxy(obj, {
          get: (_, k) => {
              const key = String(k);
              let nextSpec;
              if ('Index' in spec) {
                  nextSpec = spec.Index(key, context, path);
              }
              else if ('Interface' in spec) {
                  if (!(key in spec.Interface)) {
                      throw new Error(`Interface has no entry "${String(key)}"`);
                  }
                  nextSpec = spec.Interface[key];
              }
              else {
                  throw new Error('no builder');
              }
              return proxyAsAssigner$1(nextSpec, 
              // We use this form here instead of `obj[key]` specifically
              // to allow Assign to play well with `ProtectedIndex`, which
              // would raise an error if trying to access an undefined key.
              key in obj ? obj[key] : undefined, context, _addPath$1(obj, key, path));
          },
          set: _proxySetHandlerReadOnly$1,
      });
  };
  proxyAsAssigner$1.ensureValue = (_obj, spec, context, _path, _recursionPath) => {
      if ('Index' in spec) {
          return (_obj || spec.indexConstructor(context, _ensurePath$1(_path)));
      }
      else if ('Interface' in spec) {
          const obj = (_obj || {});
          Object.entries(spec.Interface).forEach(([key, nextSpec]) => {
              obj[key] = proxyAsAssigner$1.ensureValue(obj[key], nextSpec, context, _addPath$1(obj, key, _path), _addPath$1(obj, key, _recursionPath));
          });
          return obj;
      }
      else if ('Literal' in spec) {
          return (_obj || spec.Literal(context, _ensurePath$1(_path)));
      }
      else if ('LiteralDefaultNull' in spec) {
          if (!_recursionPath) {
              return (_obj ||
                  spec.LiteralDefaultNull(context, _ensurePath$1(_path)));
          }
          else {
              return (_obj || null);
          }
      }
      else {
          throw new Error('Invalid Assigner');
      }
  };
  proxyAsAssigner$1.Interface = (a) => ({ Interface: a });
  proxyAsAssigner$1.Index = (f, indexConstructor) => ({
      Index: f,
      indexConstructor: indexConstructor || (() => ({})),
  });
  proxyAsAssigner$1.Literal = (f) => ({
      Literal: f,
  });
  proxyAsAssigner$1.LiteralDefaultNull = (f) => ({ LiteralDefaultNull: f });
  // ---------------------------- proxyAsProtectedIndex ---------------------------- //
  /**
   * Helper to declare namespace objects enforcing stricter access rules.
   * Specifically, it forbids :
   * - reading an unknown property.
   * - trying to overwrite an existing property.
   */
  const proxyAsProtectedIndex$1 = (namespace, path) => {
      return new Proxy(namespace, {
          get: (target, k) => {
              const key = String(k);
              if (_proxyGetHandlerThrowIfKeyUnknown$1(target, key, path)) {
                  return undefined;
              }
              return target[key];
          },
          set: (target, k, newValue) => {
              const key = _trimDollarKey$1(String(k));
              if (target.hasOwnProperty(key)) {
                  throw new Error(`Key "${String(key)}" is protected and cannot be overwritten.`);
              }
              else {
                  target[key] = newValue;
              }
              return newValue;
          },
      });
  };
  const _trimDollarKey$1 = (key) => {
      const match = /\$(.*)/.exec(key);
      if (!match) {
          return key;
      }
      else {
          return match[1];
      }
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  const getNode$1 = (graph, nodeId) => {
      const node = graph[nodeId];
      if (node) {
          return node;
      }
      throw new Error(`Node "${nodeId}" not found in graph`);
  };

  /** Helper to get node implementation or throw an error if not implemented. */
  const getNodeImplementation$1 = (nodeImplementations, nodeType) => {
      const nodeImplementation = nodeImplementations[nodeType];
      if (!nodeImplementation) {
          throw new Error(`node [${nodeType}] is not implemented`);
      }
      return {
          dependencies: [],
          ...nodeImplementation,
      };
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  /** Generate an integer series from 0 to `count` (non-inclusive). */
  const countTo$1 = (count) => {
      const results = [];
      for (let i = 0; i < count; i++) {
          results.push(i);
      }
      return results;
  };

  const Sequence$1 = (content) => ({
      astType: 'Sequence',
      content: _processRawContent$1(_intersperse$1(content, countTo$1(content.length - 1).map(() => '\n'))),
  });
  const ast$1 = (strings, ...content) => _preventToString$1({
      astType: 'Sequence',
      content: _processRawContent$1(_intersperse$1(strings, content)),
  });
  const _processRawContent$1 = (content) => {
      // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings
      // Basically converts input to an Array<AstContent>.
      const flattenedAndFiltered = content.flatMap((element) => {
          if (typeof element === 'string') {
              return [element];
          }
          else if (typeof element === 'number') {
              return [element.toString()];
          }
          else {
              if (element === null) {
                  return [];
              }
              else if (Array.isArray(element)) {
                  return _processRawContent$1(_intersperse$1(element, countTo$1(element.length - 1).map(() => '\n')));
              }
              else if (typeof element === 'object' &&
                  element.astType === 'Sequence') {
                  return element.content;
              }
              else {
                  return [element];
              }
          }
      });
      // 2. Combine adjacent strings
      const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {
          if (typeof element === 'string') {
              return [combinedContent, currentString + element];
          }
          else {
              if (currentString.length) {
                  return [[...combinedContent, currentString, element], ''];
              }
              else {
                  return [[...combinedContent, element], ''];
              }
          }
      }, [[], '']);
      if (remainingString.length) {
          combinedContent.push(remainingString);
      }
      return combinedContent;
  };
  /**
   * Intersperse content from array1 with content from array2.
   * `array1.length` must be equal to `array2.length + 1`.
   */
  const _intersperse$1 = (array1, array2) => {
      if (array1.length === 0) {
          return [];
      }
      return array1.slice(1).reduce((combinedContent, element, i) => {
          return combinedContent.concat([array2[i], element]);
      }, [array1[0]]);
  };
  /**
   * Prevents AST elements from being rendered as a string, as this is
   * most likely an error due to unproper use of `ast`.
   * Deacivated. Activate for debugging by uncommenting the line below.
   */
  const _preventToString$1 = (element) => ({
      ...element,
      // Uncomment this to activate
      // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }
  });

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  // ---------------------------- VariableNamesIndex ---------------------------- //
  const NS$1 = {
      GLOBALS: 'G',
      NODES: 'N',
      NODE_TYPES: 'NT',
      IO: 'IO',
      COLD: 'COLD',
  };
  proxyAsAssigner$1.Interface({
      nodes: proxyAsAssigner$1.Index((nodeId) => proxyAsAssigner$1.Interface({
          signalOuts: proxyAsAssigner$1.Index((portletId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.NODES, nodeId, 'outs', portletId))),
          messageSenders: proxyAsAssigner$1.Index((portletId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.NODES, nodeId, 'snds', portletId))),
          messageReceivers: proxyAsAssigner$1.Index((portletId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.NODES, nodeId, 'rcvs', portletId))),
          state: proxyAsAssigner$1.LiteralDefaultNull(() => _name$1(NS$1.NODES, nodeId, 'state')),
      })),
      nodeImplementations: proxyAsAssigner$1.Index((nodeType, { nodeImplementations }) => {
          const nodeImplementation = getNodeImplementation$1(nodeImplementations, nodeType);
          const nodeTypePrefix = (nodeImplementation.flags
              ? nodeImplementation.flags.alphaName
              : null) || nodeType;
          return proxyAsAssigner$1.Index((name) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.NODE_TYPES, nodeTypePrefix, name)));
      }),
      globals: proxyAsAssigner$1.Index((ns) => proxyAsAssigner$1.Index((name) => {
          if (['fs'].includes(ns)) {
              return proxyAsAssigner$1.Literal(() => _name$1(NS$1.GLOBALS, ns, name));
              // We don't prefix stdlib core module, because these are super
              // basic functions that are always included in the global scope.
          }
          else if (ns === 'core') {
              return proxyAsAssigner$1.Literal(() => name);
          }
          else {
              return proxyAsAssigner$1.Literal(() => _name$1(NS$1.GLOBALS, ns, name));
          }
      })),
      io: proxyAsAssigner$1.Interface({
          messageReceivers: proxyAsAssigner$1.Index((nodeId) => proxyAsAssigner$1.Index((inletId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.IO, 'rcv', nodeId, inletId)))),
          messageSenders: proxyAsAssigner$1.Index((nodeId) => proxyAsAssigner$1.Index((outletId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.IO, 'snd', nodeId, outletId)))),
      }),
      coldDspGroups: proxyAsAssigner$1.Index((groupId) => proxyAsAssigner$1.Literal(() => _name$1(NS$1.COLD, groupId))),
  });
  // ---------------------------- PrecompiledCode ---------------------------- //
  proxyAsAssigner$1.Interface({
      graph: proxyAsAssigner$1.Literal((_, path) => ({
          fullTraversal: [],
          hotDspGroup: {
              traversal: [],
              outNodesIds: [],
          },
          coldDspGroups: proxyAsProtectedIndex$1({}, path),
      })),
      nodeImplementations: proxyAsAssigner$1.Index((nodeType, { nodeImplementations }) => proxyAsAssigner$1.Literal(() => ({
          nodeImplementation: getNodeImplementation$1(nodeImplementations, nodeType),
          stateClass: null,
          core: null,
      })), (_, path) => proxyAsProtectedIndex$1({}, path)),
      nodes: proxyAsAssigner$1.Index((nodeId, { graph }) => proxyAsAssigner$1.Literal(() => ({
          nodeType: getNode$1(graph, nodeId).type,
          messageReceivers: {},
          messageSenders: {},
          signalOuts: {},
          signalIns: {},
          initialization: ast$1 ``,
          dsp: {
              loop: ast$1 ``,
              inlets: {},
          },
          state: null,
      })), (_, path) => proxyAsProtectedIndex$1({}, path)),
      dependencies: proxyAsAssigner$1.Literal(() => ({
          imports: [],
          exports: [],
          ast: Sequence$1([]),
      })),
      io: proxyAsAssigner$1.Interface({
          messageReceivers: proxyAsAssigner$1.Index((_) => proxyAsAssigner$1.Literal((_, path) => proxyAsProtectedIndex$1({}, path)), (_, path) => proxyAsProtectedIndex$1({}, path)),
          messageSenders: proxyAsAssigner$1.Index((_) => proxyAsAssigner$1.Literal((_, path) => proxyAsProtectedIndex$1({}, path)), (_, path) => proxyAsProtectedIndex$1({}, path)),
      }),
  });
  // ---------------------------- MISC ---------------------------- //
  const _name$1 = (...parts) => parts.map(assertValidNamePart$1).join('_');
  const assertValidNamePart$1 = (namePart) => {
      const isInvalid = !VALID_NAME_PART_REGEXP$1.exec(namePart);
      if (isInvalid) {
          throw new Error(`Invalid variable name for code generation "${namePart}"`);
      }
      return namePart;
  };
  const VALID_NAME_PART_REGEXP$1 = /^[a-zA-Z0-9_]+$/;

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  const FS_OPERATION_SUCCESS = 0;
  const FS_OPERATION_FAILURE = 1;

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  var readSoundFile = async (node, payload, settings) => {
      if (payload.functionName === 'onReadSoundFile') {
          const [operationId, url, [channelCount]] = payload.arguments;
          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);
          let operationStatus = FS_OPERATION_SUCCESS;
          let sound = null;
          try {
              sound = await fakeFs.readSound(absoluteUrl, node.context);
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

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  const BUFFER_HIGH = 10 * 44100;
  const BUFFER_LOW = BUFFER_HIGH / 2;
  var readSoundStream = async (node, payload, settings) => {
      if (payload.functionName === 'onOpenSoundReadStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          try {
              const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);
              await fakeFs.readStreamSound(operationId, absoluteUrl, channelCount, node.context);
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

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  var writeSoundFile = async (node, payload, settings) => {
      if (payload.functionName === 'onWriteSoundFile') {
          const [operationId, sound, url, [channelCount]] = payload.arguments;
          const fixedSound = fixSoundChannelCount(sound, channelCount);
          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);
          await fakeFs.writeSound(fixedSound, absoluteUrl);
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

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  var writeSoundStream = async (_, payload, settings) => {
      if (payload.functionName === 'onOpenSoundWriteStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);
          await fakeFs.writeStreamSound(operationId, absoluteUrl, channelCount);
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

  var index = async (node, messageEvent, settings) => {
      const message = messageEvent.data;
      if (message.type !== 'fs') {
          throw new Error(`Unknown message type from node ${message.type}`);
      }
      const { payload } = message;
      if (payload.functionName === 'onReadSoundFile' ||
          payload.functionName === 'sendReadSoundFileResponse_return') {
          readSoundFile(node, payload, settings);
      }
      else if (payload.functionName === 'onOpenSoundReadStream' ||
          payload.functionName === 'sendSoundStreamData_return') {
          readSoundStream(node, payload, settings);
      }
      else if (payload.functionName === 'onWriteSoundFile' ||
          payload.functionName === 'sendWriteSoundFileResponse_return') {
          writeSoundFile(node, payload, settings);
      }
      else if (payload.functionName === 'onOpenSoundWriteStream' ||
          payload.functionName === 'onSoundStreamData') {
          writeSoundStream(node, payload, settings);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          writeSoundStream(node, payload, settings);
          readSoundStream(node, payload, settings);
      }
      else if (payload.functionName === 'onCloseSoundStream') {
          closeSoundStream(node, payload);
      }
      else {
          throw new Error(`Unknown callback ${payload.functionName}`);
      }
  };

  var initialize = (...args) => {
      return registerWebPdWorkletNode(...args);
  };

  const urlDirName = (url) => {
      if (isExternalUrl(url)) {
          return new URL('.', url).href;
      }
      else {
          return new URL('.', new URL(url, document.URL).href).href;
      }
  };
  const isExternalUrl = (urlString) => {
      try {
          const url = new URL(urlString);
          if (url.origin !== new URL(document.URL, document.baseURI).origin) {
              return true;
          }
      }
      catch (_e) {
          new URL(urlString, document.baseURI);
      }
      return false;
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  /** Generate an integer series from 0 to `count` (non-inclusive). */
  const countTo = (count) => {
      const results = [];
      for (let i = 0; i < count; i++) {
          results.push(i);
      }
      return results;
  };

  const Sequence = (content) => ({
      astType: 'Sequence',
      content: _processRawContent(_intersperse(content, countTo(content.length - 1).map(() => '\n'))),
  });
  const ast = (strings, ...content) => _preventToString({
      astType: 'Sequence',
      content: _processRawContent(_intersperse(strings, content)),
  });
  const _processRawContent = (content) => {
      // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings
      // Basically converts input to an Array<AstContent>.
      const flattenedAndFiltered = content.flatMap((element) => {
          if (typeof element === 'string') {
              return [element];
          }
          else if (typeof element === 'number') {
              return [element.toString()];
          }
          else {
              if (element === null) {
                  return [];
              }
              else if (Array.isArray(element)) {
                  return _processRawContent(_intersperse(element, countTo(element.length - 1).map(() => '\n')));
              }
              else if (typeof element === 'object' &&
                  element.astType === 'Sequence') {
                  return element.content;
              }
              else {
                  return [element];
              }
          }
      });
      // 2. Combine adjacent strings
      const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {
          if (typeof element === 'string') {
              return [combinedContent, currentString + element];
          }
          else {
              if (currentString.length) {
                  return [[...combinedContent, currentString, element], ''];
              }
              else {
                  return [[...combinedContent, element], ''];
              }
          }
      }, [[], '']);
      if (remainingString.length) {
          combinedContent.push(remainingString);
      }
      return combinedContent;
  };
  /**
   * Intersperse content from array1 with content from array2.
   * `array1.length` must be equal to `array2.length + 1`.
   */
  const _intersperse = (array1, array2) => {
      if (array1.length === 0) {
          return [];
      }
      return array1.slice(1).reduce((combinedContent, element, i) => {
          return combinedContent.concat([array2[i], element]);
      }, [array1[0]]);
  };
  /**
   * Prevents AST elements from being rendered as a string, as this is
   * most likely an error due to unproper use of `ast`.
   * Deacivated. Activate for debugging by uncommenting the line below.
   */
  const _preventToString = (element) => ({
      ...element,
      // Uncomment this to activate
      // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }
  });

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  const getNode = (graph, nodeId) => {
      const node = graph[nodeId];
      if (node) {
          return node;
      }
      throw new Error(`Node "${nodeId}" not found in graph`);
  };

  /** Helper to get node implementation or throw an error if not implemented. */
  const getNodeImplementation = (nodeImplementations, nodeType) => {
      const nodeImplementation = nodeImplementations[nodeType];
      if (!nodeImplementation) {
          throw new Error(`node [${nodeType}] is not implemented`);
      }
      return {
          dependencies: [],
          ...nodeImplementation,
      };
  };

  const _addPath = (parent, key, _path) => {
      const path = _ensurePath(_path);
      return {
          keys: [...path.keys, key],
          parents: [...path.parents, parent],
      };
  };
  const _ensurePath = (path) => path || {
      keys: [],
      parents: [],
  };
  const _proxySetHandlerReadOnly = () => {
      throw new Error('This Proxy is read-only.');
  };
  const _proxyGetHandlerThrowIfKeyUnknown = (target, key, path) => {
      if (!(key in target)) {
          // Whitelist some fields that are undefined but accessed at
          // some point or another by our code.
          // TODO : find a better way to do this.
          if ([
              'toJSON',
              'Symbol(Symbol.toStringTag)',
              'constructor',
              '$typeof',
              '$$typeof',
              '@@__IMMUTABLE_ITERABLE__@@',
              '@@__IMMUTABLE_RECORD__@@',
              'then',
          ].includes(key)) {
              return true;
          }
          throw new Error(`namespace${path ? ` <${path.keys.join('.')}>` : ''} doesn't know key "${String(key)}"`);
      }
      return false;
  };
  const proxyAsAssigner = (spec, _obj, context, _path) => {
      const path = _path || { keys: [], parents: [] };
      const obj = proxyAsAssigner.ensureValue(_obj, spec, context, path);
      // If `_path` is provided, assign the new value to the parent object.
      if (_path) {
          const parent = _path.parents[_path.parents.length - 1];
          const key = _path.keys[_path.keys.length - 1];
          // The only case where we want to overwrite the existing value
          // is when it was a `null` assigned by `LiteralDefaultNull`, and
          // we want to set the real value instead.
          if (!(key in parent) || 'LiteralDefaultNull' in spec) {
              parent[key] = obj;
          }
      }
      // If the object is a Literal, end of the recursion.
      if ('Literal' in spec || 'LiteralDefaultNull' in spec) {
          return obj;
      }
      return new Proxy(obj, {
          get: (_, k) => {
              const key = String(k);
              let nextSpec;
              if ('Index' in spec) {
                  nextSpec = spec.Index(key, context, path);
              }
              else if ('Interface' in spec) {
                  if (!(key in spec.Interface)) {
                      throw new Error(`Interface has no entry "${String(key)}"`);
                  }
                  nextSpec = spec.Interface[key];
              }
              else {
                  throw new Error('no builder');
              }
              return proxyAsAssigner(nextSpec, 
              // We use this form here instead of `obj[key]` specifically
              // to allow Assign to play well with `ProtectedIndex`, which
              // would raise an error if trying to access an undefined key.
              key in obj ? obj[key] : undefined, context, _addPath(obj, key, path));
          },
          set: _proxySetHandlerReadOnly,
      });
  };
  proxyAsAssigner.ensureValue = (_obj, spec, context, _path, _recursionPath) => {
      if ('Index' in spec) {
          return (_obj || spec.indexConstructor(context, _ensurePath(_path)));
      }
      else if ('Interface' in spec) {
          const obj = (_obj || {});
          Object.entries(spec.Interface).forEach(([key, nextSpec]) => {
              obj[key] = proxyAsAssigner.ensureValue(obj[key], nextSpec, context, _addPath(obj, key, _path), _addPath(obj, key, _recursionPath));
          });
          return obj;
      }
      else if ('Literal' in spec) {
          return (_obj || spec.Literal(context, _ensurePath(_path)));
      }
      else if ('LiteralDefaultNull' in spec) {
          if (!_recursionPath) {
              return (_obj ||
                  spec.LiteralDefaultNull(context, _ensurePath(_path)));
          }
          else {
              return (_obj || null);
          }
      }
      else {
          throw new Error('Invalid Assigner');
      }
  };
  proxyAsAssigner.Interface = (a) => ({ Interface: a });
  proxyAsAssigner.Index = (f, indexConstructor) => ({
      Index: f,
      indexConstructor: indexConstructor || (() => ({})),
  });
  proxyAsAssigner.Literal = (f) => ({
      Literal: f,
  });
  proxyAsAssigner.LiteralDefaultNull = (f) => ({ LiteralDefaultNull: f });
  // ---------------------------- proxyAsProtectedIndex ---------------------------- //
  /**
   * Helper to declare namespace objects enforcing stricter access rules.
   * Specifically, it forbids :
   * - reading an unknown property.
   * - trying to overwrite an existing property.
   */
  const proxyAsProtectedIndex = (namespace, path) => {
      return new Proxy(namespace, {
          get: (target, k) => {
              const key = String(k);
              if (_proxyGetHandlerThrowIfKeyUnknown(target, key, path)) {
                  return undefined;
              }
              return target[key];
          },
          set: (target, k, newValue) => {
              const key = _trimDollarKey(String(k));
              if (target.hasOwnProperty(key)) {
                  throw new Error(`Key "${String(key)}" is protected and cannot be overwritten.`);
              }
              else {
                  target[key] = newValue;
              }
              return newValue;
          },
      });
  };
  const _trimDollarKey = (key) => {
      const match = /\$(.*)/.exec(key);
      if (!match) {
          return key;
      }
      else {
          return match[1];
      }
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  // ---------------------------- VariableNamesIndex ---------------------------- //
  const NS = {
      GLOBALS: 'G',
      NODES: 'N',
      NODE_TYPES: 'NT',
      IO: 'IO',
      COLD: 'COLD',
  };
  proxyAsAssigner.Interface({
      nodes: proxyAsAssigner.Index((nodeId) => proxyAsAssigner.Interface({
          signalOuts: proxyAsAssigner.Index((portletId) => proxyAsAssigner.Literal(() => _name(NS.NODES, nodeId, 'outs', portletId))),
          messageSenders: proxyAsAssigner.Index((portletId) => proxyAsAssigner.Literal(() => _name(NS.NODES, nodeId, 'snds', portletId))),
          messageReceivers: proxyAsAssigner.Index((portletId) => proxyAsAssigner.Literal(() => _name(NS.NODES, nodeId, 'rcvs', portletId))),
          state: proxyAsAssigner.LiteralDefaultNull(() => _name(NS.NODES, nodeId, 'state')),
      })),
      nodeImplementations: proxyAsAssigner.Index((nodeType, { nodeImplementations }) => {
          const nodeImplementation = getNodeImplementation(nodeImplementations, nodeType);
          const nodeTypePrefix = (nodeImplementation.flags
              ? nodeImplementation.flags.alphaName
              : null) || nodeType;
          return proxyAsAssigner.Index((name) => proxyAsAssigner.Literal(() => _name(NS.NODE_TYPES, nodeTypePrefix, name)));
      }),
      globals: proxyAsAssigner.Index((ns) => proxyAsAssigner.Index((name) => {
          if (['fs'].includes(ns)) {
              return proxyAsAssigner.Literal(() => _name(NS.GLOBALS, ns, name));
              // We don't prefix stdlib core module, because these are super
              // basic functions that are always included in the global scope.
          }
          else if (ns === 'core') {
              return proxyAsAssigner.Literal(() => name);
          }
          else {
              return proxyAsAssigner.Literal(() => _name(NS.GLOBALS, ns, name));
          }
      })),
      io: proxyAsAssigner.Interface({
          messageReceivers: proxyAsAssigner.Index((nodeId) => proxyAsAssigner.Index((inletId) => proxyAsAssigner.Literal(() => _name(NS.IO, 'rcv', nodeId, inletId)))),
          messageSenders: proxyAsAssigner.Index((nodeId) => proxyAsAssigner.Index((outletId) => proxyAsAssigner.Literal(() => _name(NS.IO, 'snd', nodeId, outletId)))),
      }),
      coldDspGroups: proxyAsAssigner.Index((groupId) => proxyAsAssigner.Literal(() => _name(NS.COLD, groupId))),
  });
  // ---------------------------- PrecompiledCode ---------------------------- //
  proxyAsAssigner.Interface({
      graph: proxyAsAssigner.Literal((_, path) => ({
          fullTraversal: [],
          hotDspGroup: {
              traversal: [],
              outNodesIds: [],
          },
          coldDspGroups: proxyAsProtectedIndex({}, path),
      })),
      nodeImplementations: proxyAsAssigner.Index((nodeType, { nodeImplementations }) => proxyAsAssigner.Literal(() => ({
          nodeImplementation: getNodeImplementation(nodeImplementations, nodeType),
          stateClass: null,
          core: null,
      })), (_, path) => proxyAsProtectedIndex({}, path)),
      nodes: proxyAsAssigner.Index((nodeId, { graph }) => proxyAsAssigner.Literal(() => ({
          nodeType: getNode(graph, nodeId).type,
          messageReceivers: {},
          messageSenders: {},
          signalOuts: {},
          signalIns: {},
          initialization: ast ``,
          dsp: {
              loop: ast ``,
              inlets: {},
          },
          state: null,
      })), (_, path) => proxyAsProtectedIndex({}, path)),
      dependencies: proxyAsAssigner.Literal(() => ({
          imports: [],
          exports: [],
          ast: Sequence([]),
      })),
      io: proxyAsAssigner.Interface({
          messageReceivers: proxyAsAssigner.Index((_) => proxyAsAssigner.Literal((_, path) => proxyAsProtectedIndex({}, path)), (_, path) => proxyAsProtectedIndex({}, path)),
          messageSenders: proxyAsAssigner.Index((_) => proxyAsAssigner.Literal((_, path) => proxyAsProtectedIndex({}, path)), (_, path) => proxyAsProtectedIndex({}, path)),
      }),
  });
  // ---------------------------- MISC ---------------------------- //
  const _name = (...parts) => parts.map(assertValidNamePart).join('_');
  const assertValidNamePart = (namePart) => {
      const isInvalid = !VALID_NAME_PART_REGEXP.exec(namePart);
      if (isInvalid) {
          throw new Error(`Invalid variable name for code generation "${namePart}"`);
      }
      return namePart;
  };
  const VALID_NAME_PART_REGEXP = /^[a-zA-Z0-9_]+$/;

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  // NOTE : not necessarily the most logical place to put this function, but we need it here
  // cause it's imported by the bindings.
  const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;
  const proxyAsModuleWithBindings = (rawModule, bindings) => 
  // Use empty object on proxy cause proxy cannot redefine access of member of its target,
  // which causes issues for example for WebAssembly exports.
  // See : https://stackoverflow.com/questions/75148897/get-on-proxy-property-items-is-a-read-only-and-non-configurable-data-proper
  new Proxy({}, {
      get: (_, k) => {
          if (bindings.hasOwnProperty(k)) {
              const key = String(k);
              const bindingSpec = bindings[key];
              switch (bindingSpec.type) {
                  case 'raw':
                      // Cannot use hasOwnProperty here cause not defined in wasm exports object
                      if (k in rawModule) {
                          return rawModule[key];
                      }
                      else {
                          throw new Error(`Key ${String(key)} doesn't exist in raw module`);
                      }
                  case 'proxy':
                  case 'callback':
                      return bindingSpec.value;
              }
              // We need to return undefined here for compatibility with various APIs
              // which inspect object's attributes.
          }
          else {
              return undefined;
          }
      },
      has: function (_, k) {
          return k in bindings;
      },
      set: (_, k, newValue) => {
          if (bindings.hasOwnProperty(String(k))) {
              const key = String(k);
              const bindingSpec = bindings[key];
              if (bindingSpec.type === 'callback') {
                  bindingSpec.value = newValue;
              }
              else {
                  throw new Error(`Binding key ${String(key)} is read-only`);
              }
          }
          else {
              throw new Error(`Key ${String(k)} is not defined in bindings`);
          }
          return true;
      },
  });
  /**
   * Reverse-maps exported variable names from `rawModule` according to the mapping defined
   * in `variableNamesIndex`.
   *
   * For example with :
   *
   * ```
   * const variableNamesIndex = {
   *     globals: {
   *         // ...
   *         fs: {
   *             // ...
   *             readFile: 'g_fs_readFile'
   *         },
   *     }
   * }
   * ```
   *
   * The function `g_fs_readFile` (if it is exported properly by the raw module), will then
   * be available on the returned object at path `.globals.fs.readFile`.
   */
  const proxyWithEngineNameMapping = (rawModule, variableNamesIndex) => proxyWithNameMapping(rawModule, {
      globals: variableNamesIndex.globals,
      io: variableNamesIndex.io,
  });
  const proxyWithNameMapping = (rawModule, variableNamesIndex) => {
      if (typeof variableNamesIndex === 'string') {
          return rawModule[variableNamesIndex];
      }
      else if (typeof variableNamesIndex === 'object') {
          return new Proxy(rawModule, {
              get: (_, k) => {
                  const key = String(k);
                  if (key in rawModule) {
                      return Reflect.get(rawModule, key);
                  }
                  else if (key in variableNamesIndex) {
                      const nextVariableNames = variableNamesIndex[key];
                      return proxyWithNameMapping(rawModule, nextVariableNames);
                  }
                  else if (_proxyGetHandlerThrowIfKeyUnknown(rawModule, key)) {
                      return undefined;
                  }
              },
              has: function (_, k) {
                  return k in rawModule || k in variableNamesIndex;
              },
              set: (_, k, value) => {
                  const key = String(k);
                  if (key in variableNamesIndex) {
                      const variableName = variableNamesIndex[key];
                      if (typeof variableName !== 'string') {
                          throw new Error(`Failed to set value for key ${String(k)}: variable name is not a string`);
                      }
                      return Reflect.set(rawModule, variableName, value);
                  }
                  else {
                      throw new Error(`Key ${String(k)} is not defined in raw module`);
                  }
              },
          });
      }
      else {
          throw new Error(`Invalid name mapping`);
      }
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  /** @copyright Assemblyscript ESM bindings */
  const liftString = (rawModule, pointer) => {
      if (!pointer) {
          throw new Error('Cannot lift a null pointer');
      }
      pointer = pointer >>> 0;
      const end = (pointer +
          new Uint32Array(rawModule.memory.buffer)[(pointer - 4) >>> 2]) >>>
          1;
      const memoryU16 = new Uint16Array(rawModule.memory.buffer);
      let start = pointer >>> 1;
      let string = '';
      while (end - start > 1024) {
          string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
      }
      return string + String.fromCharCode(...memoryU16.subarray(start, end));
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  // REF : Assemblyscript ESM bindings
  const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {
      const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {
          env: {
              abort: (messagePointer, 
              // filename, not useful because we compile everything to a single string
              _, lineNumber, columnNumber) => {
                  const message = liftString(wasmExports, messagePointer);
                  lineNumber = lineNumber;
                  columnNumber = columnNumber;
                  (() => {
                      // @external.js
                      throw Error(`${message} at ${lineNumber}:${columnNumber}`);
                  })();
              },
              seed: () => {
                  return (() => {
                      return Date.now() * Math.random();
                  })();
              },
              'console.log': (textPointer) => {
                  console.log(liftString(wasmExports, textPointer));
              },
          },
          ...wasmImports,
      });
      const wasmExports = instanceAndModule.instance
          .exports;
      return instanceAndModule.instance;
  };

  const readMetadata$2 = async (wasmBuffer) => {
      // In order to read metadata, we need to introspect the module to get the imports
      const inputImports = {};
      const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));
      // Then we generate dummy functions to be able to instantiate the module
      wasmModule
          .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')
          .forEach((imprt) => (inputImports[imprt.name] = () => undefined));
      const wasmInstance = await instantiateWasmModule(wasmBuffer, {
          input: inputImports,
      });
      // Finally, once the module instantiated, we read the metadata
      const rawModule = wasmInstance.exports;
      const stringPointer = rawModule.metadata.valueOf();
      const metadataJSON = liftString(rawModule, stringPointer);
      return JSON.parse(metadataJSON);
  };

  const createFsModule = (rawModule) => {
      const fsExportedNames = rawModule.metadata.compilation.variableNamesIndex.globals.fs;
      const fs = proxyAsModuleWithBindings(rawModule, {
          onReadSoundFile: { type: 'callback', value: () => undefined },
          onWriteSoundFile: { type: 'callback', value: () => undefined },
          onOpenSoundReadStream: { type: 'callback', value: () => undefined },
          onOpenSoundWriteStream: { type: 'callback', value: () => undefined },
          onSoundStreamData: { type: 'callback', value: () => undefined },
          onCloseSoundStream: { type: 'callback', value: () => undefined },
          sendReadSoundFileResponse: {
              type: 'proxy',
              value: 'x_onReadSoundFileResponse' in fsExportedNames
                  ? rawModule.globals.fs.x_onReadSoundFileResponse
                  : undefined,
          },
          sendWriteSoundFileResponse: {
              type: 'proxy',
              value: 'x_onWriteSoundFileResponse' in fsExportedNames
                  ? rawModule.globals.fs.x_onWriteSoundFileResponse
                  : undefined,
          },
          // should register the operation success { bitDepth: 32, target: 'javascript' }
          sendSoundStreamData: {
              type: 'proxy',
              value: 'x_onSoundStreamData' in fsExportedNames
                  ? rawModule.globals.fs.x_onSoundStreamData
                  : undefined,
          },
          closeSoundStream: {
              type: 'proxy',
              value: 'x_onCloseSoundStream' in fsExportedNames
                  ? rawModule.globals.fs.x_onCloseSoundStream
                  : undefined,
          },
      });
      if ('i_openSoundWriteStream' in fsExportedNames) {
          rawModule.globals.fs.i_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);
      }
      if ('i_sendSoundStreamData' in fsExportedNames) {
          rawModule.globals.fs.i_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);
      }
      if ('i_openSoundReadStream' in fsExportedNames) {
          rawModule.globals.fs.i_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);
      }
      if ('i_closeSoundStream' in fsExportedNames) {
          rawModule.globals.fs.i_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);
      }
      if ('i_writeSoundFile' in fsExportedNames) {
          rawModule.globals.fs.i_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);
      }
      if ('i_readSoundFile' in fsExportedNames) {
          rawModule.globals.fs.i_readSoundFile = (...args) => fs.onReadSoundFile(...args);
      }
      return fs;
  };

  const createCommonsModule = (rawModule, metadata) => {
      const floatArrayType = getFloatArrayType(metadata.settings.audio.bitDepth);
      return proxyAsModuleWithBindings(rawModule, {
          getArray: {
              type: 'proxy',
              value: (arrayName) => rawModule.globals.commons.getArray(arrayName),
          },
          setArray: {
              type: 'proxy',
              value: (arrayName, array) => rawModule.globals.commons.setArray(arrayName, new floatArrayType(array)),
          },
      });
  };

  /*
   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
   *
   * This file is part of WebPd
   * (see https://github.com/sebpiq/WebPd).
   *
   * This program is free software: you can redistribute it and/or modify
   * it under the terms of the GNU Lesser General Public License as published by
   * the Free Software Foundation, either version 3 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU Lesser General Public License for more details.
   *
   * You should have received a copy of the GNU Lesser General Public License
   * along with this program. If not, see <http://www.gnu.org/licenses/>.
   */
  /**
   * These bindings enable easier interaction with modules generated with our JavaScript compilation.
   * For example : instantiation, passing data back and forth, etc ...
   *
   * **Warning** : These bindings are compiled with rollup as a standalone JS module for inclusion in other libraries.
   * In consequence, they are meant to be kept lightweight, and should avoid importing dependencies.
   *
   * @module
   */
  const compileRawModule = (code) => new Function(`
        ${code}
        return exports
    `)();
  const createEngineBindings = (rawModule) => {
      const exportedNames = rawModule.metadata.compilation.variableNamesIndex.globals;
      const globalsBindings = {
          commons: {
              type: 'proxy',
              value: createCommonsModule(rawModule, rawModule.metadata),
          },
      };
      if ('fs' in exportedNames) {
          globalsBindings.fs = { type: 'proxy', value: createFsModule(rawModule) };
      }
      return {
          metadata: { type: 'raw' },
          initialize: { type: 'raw' },
          dspLoop: { type: 'raw' },
          io: { type: 'raw' },
          globals: {
              type: 'proxy',
              value: proxyAsModuleWithBindings(rawModule, globalsBindings),
          },
      };
  };
  const createEngine = (code, additionalBindings) => {
      const rawModule = compileRawModule(code);
      const rawModuleWithNameMapping = proxyWithEngineNameMapping(rawModule, rawModule.metadata.compilation.variableNamesIndex);
      return proxyAsModuleWithBindings(rawModule, {
          ...createEngineBindings(rawModuleWithNameMapping),
          ...(additionalBindings || {}),
      });
  };

  const readMetadata$1 = async (target, compiled) => {
      switch (target) {
          case 'assemblyscript':
              return readMetadata$2(compiled);
          case 'javascript':
              return createEngine(compiled).metadata;
      }
  };

  const defaultSettingsForRun = (patchUrl, messageSender) => {
      const rootUrl = urlDirName(patchUrl);
      return {
          messageHandler: (node, messageEvent) => {
              const message = messageEvent.data;
              switch (message.type) {
                  case 'fs':
                      return index(node, messageEvent, { rootUrl });
                  case 'io:messageSender':
                      if (messageSender) {
                          messageSender(message.payload.nodeId, message.payload.portletId, message.payload.message);
                      }
                      return null;
                  default:
                      return null;
              }
          },
      };
  };
  const readMetadata = (compiledPatch) => {
      if (typeof compiledPatch === 'string') {
          return readMetadata$1('javascript', compiledPatch);
      }
      else {
          return readMetadata$1('assemblyscript', compiledPatch);
      }
  };

  var run = async (audioContext, compiledPatch, settings) => {
      const { messageHandler } = settings;
      const webpdNode = new WebPdWorkletNode(audioContext);
      webpdNode.port.onmessage = (msg) => messageHandler(webpdNode, msg);
      if (typeof compiledPatch === 'string') {
          webpdNode.port.postMessage({
              type: 'code:JS',
              payload: {
                  jsCode: compiledPatch,
              },
          });
      }
      else {
          webpdNode.port.postMessage({
              type: 'code:WASM',
              payload: {
                  wasmBuffer: compiledPatch,
              },
          });
      }
      return webpdNode;
  };

  exports.defaultSettingsForRun = defaultSettingsForRun;
  exports.initialize = initialize;
  exports.readMetadata = readMetadata;
  exports.run = run;

  return exports;

})({});
