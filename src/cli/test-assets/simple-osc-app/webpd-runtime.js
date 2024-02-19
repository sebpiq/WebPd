var WebPdRuntime = (function (exports) {
  'use strict';

  var WEB_PD_WORKLET_PROCESSOR_CODE = "/*\n * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n *\n * This file is part of WebPd\n * (see https://github.com/sebpiq/WebPd).\n *\n * This program is free software: you can redistribute it and/or modify\n * it under the terms of the GNU Lesser General Public License as published by\n * the Free Software Foundation, either version 3 of the License, or\n * (at your option) any later version.\n *\n * This program is distributed in the hope that it will be useful,\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n * GNU Lesser General Public License for more details.\n *\n * You should have received a copy of the GNU Lesser General Public License\n * along with this program. If not, see <http://www.gnu.org/licenses/>.\n */\nconst FS_CALLBACK_NAMES = [\n    'onReadSoundFile',\n    'onOpenSoundReadStream',\n    'onWriteSoundFile',\n    'onOpenSoundWriteStream',\n    'onSoundStreamData',\n    'onCloseSoundStream',\n];\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\n    constructor() {\n        super();\n        this.port.onmessage = this.onMessage.bind(this);\n        this.settings = {\n            blockSize: null,\n            sampleRate,\n        };\n        this.dspConfigured = false;\n        this.engine = null;\n    }\n    process(inputs, outputs) {\n        const output = outputs[0];\n        const input = inputs[0];\n        if (!this.dspConfigured) {\n            if (!this.engine) {\n                return true;\n            }\n            this.settings.blockSize = output[0].length;\n            this.engine.initialize(this.settings.sampleRate, this.settings.blockSize);\n            this.dspConfigured = true;\n        }\n        this.engine.dspLoop(input, output);\n        return true;\n    }\n    onMessage(messageEvent) {\n        const message = messageEvent.data;\n        switch (message.type) {\n            case 'code:WASM':\n                this.setWasm(message.payload.wasmBuffer);\n                break;\n            case 'code:JS':\n                this.setJsCode(message.payload.jsCode);\n                break;\n            case 'io:messageReceiver':\n                this.engine.io.messageReceivers[message.payload.nodeId][message.payload.portletId](message.payload.message);\n                break;\n            case 'fs':\n                const returned = this.engine.fs[message.payload.functionName].apply(null, message.payload.arguments);\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName: message.payload.functionName + '_return',\n                        operationId: message.payload.arguments[0],\n                        returned,\n                    },\n                });\n                break;\n            case 'destroy':\n                this.destroy();\n                break;\n            default:\n                new Error(`unknown message type ${message.type}`);\n        }\n    }\n    // TODO : control for channelCount of wasmModule\n    setWasm(wasmBuffer) {\n        return AssemblyScriptWasmBindings.createEngine(wasmBuffer).then((engine) => this.setEngine(engine));\n    }\n    setJsCode(code) {\n        const engine = JavaScriptBindings.createEngine(code);\n        this.setEngine(engine);\n    }\n    setEngine(engine) {\n        FS_CALLBACK_NAMES.forEach((functionName) => {\n            ;\n            engine.fs[functionName] = (...args) => {\n                // We don't use transferables, because that would imply reallocating each time new array in the engine.\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName,\n                        arguments: args,\n                    },\n                });\n            };\n        });\n        this.engine = engine;\n        this.dspConfigured = false;\n    }\n    destroy() {\n        this.process = () => false;\n    }\n}\nregisterProcessor('webpd-node', WasmWorkletProcessor);\n";

  var ASSEMBLY_SCRIPT_WASM_BINDINGS_CODE = "var AssemblyScriptWasmBindings = (function (exports) {\n    'use strict';\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n    const createModule = (rawModule, bindings) => new Proxy({}, {\n        get: (_, k) => {\n            if (bindings.hasOwnProperty(k)) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                switch (bindingSpec.type) {\n                    case 'raw':\n                        if (k in rawModule) {\n                            return rawModule[key];\n                        }\n                        else {\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\n                        }\n                    case 'proxy':\n                    case 'callback':\n                        return bindingSpec.value;\n                }\n            }\n            else {\n                return undefined;\n            }\n        },\n        set: (_, k, newValue) => {\n            if (bindings.hasOwnProperty(String(k))) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                if (bindingSpec.type === 'callback') {\n                    bindingSpec.value = newValue;\n                }\n                else {\n                    throw new Error(`Binding key ${String(key)} is read-only`);\n                }\n            }\n            else {\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\n            }\n            return true;\n        },\n    });\n\n    const liftString = (wasmExports, pointer) => {\n        if (!pointer) {\n            throw new Error('Cannot lift a null pointer');\n        }\n        pointer = pointer >>> 0;\n        const end = (pointer +\n            new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\n            1;\n        const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        let start = pointer >>> 1;\n        let string = '';\n        while (end - start > 1024) {\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n        }\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\n    };\n    const lowerString = (wasmExports, value) => {\n        if (value == null) {\n            throw new Error('Cannot lower a null string');\n        }\n        const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        for (let i = 0; i < length; ++i)\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\n        return pointer;\n    };\n    const readTypedArray = (wasmExports, constructor, pointer) => {\n        if (!pointer) {\n            throw new Error('Cannot lift a null pointer');\n        }\n        const memoryU32 = new Uint32Array(wasmExports.memory.buffer);\n        return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\n    };\n    const lowerFloatArray = (wasmExports, bitDepth, data) => {\n        const arrayType = getFloatArrayType(bitDepth);\n        const arrayPointer = wasmExports.createFloatArray(data.length);\n        const array = readTypedArray(wasmExports, arrayType, arrayPointer);\n        array.set(data);\n        return { array, arrayPointer };\n    };\n    const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {\n        const arraysPointer = wasmExports.x_core_createListOfArrays();\n        data.forEach((array) => {\n            const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);\n            wasmExports.x_core_pushToListOfArrays(arraysPointer, arrayPointer);\n        });\n        return arraysPointer;\n    };\n    const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {\n        const listLength = wasmExports.x_core_getListOfArraysLength(listOfArraysPointer);\n        const arrays = [];\n        const arrayType = getFloatArrayType(bitDepth);\n        for (let i = 0; i < listLength; i++) {\n            const arrayPointer = wasmExports.x_core_getListOfArraysElem(listOfArraysPointer, i);\n            arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));\n        }\n        return arrays;\n    };\n\n    const liftMessage = (wasmExports, messagePointer) => {\n        const messageTokenTypesPointer = wasmExports.x_msg_getTokenTypes(messagePointer);\n        const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);\n        const message = [];\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\n            if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {\n                message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));\n            }\n            else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {\n                const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);\n                message.push(liftString(wasmExports, stringPointer));\n            }\n        });\n        return message;\n    };\n    const lowerMessage = (wasmExports, message) => {\n        const template = message.reduce((template, value) => {\n            if (typeof value === 'number') {\n                template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());\n            }\n            else if (typeof value === 'string') {\n                template.push(wasmExports.MSG_STRING_TOKEN.valueOf());\n                template.push(value.length);\n            }\n            else {\n                throw new Error(`invalid message value ${value}`);\n            }\n            return template;\n        }, []);\n        const templateArrayPointer = wasmExports.x_msg_createTemplate(template.length);\n        const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);\n        loweredTemplateArray.set(template);\n        const messagePointer = wasmExports.x_msg_create(templateArrayPointer);\n        message.forEach((value, index) => {\n            if (typeof value === 'number') {\n                wasmExports.msg_writeFloatToken(messagePointer, index, value);\n            }\n            else if (typeof value === 'string') {\n                const stringPointer = lowerString(wasmExports, value);\n                wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);\n            }\n        });\n        return messagePointer;\n    };\n\n    const mapObject = (src, func) => {\n        const dest = {};\n        Object.entries(src).forEach(([key, srcValue], i) => {\n            dest[key] = func(srcValue, key, i);\n        });\n        return dest;\n    };\n    const mapArray = (src, func) => {\n        const dest = {};\n        src.forEach((srcValue, i) => {\n            const [key, destValue] = func(srcValue, i);\n            dest[key] = destValue;\n        });\n        return dest;\n    };\n\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\n            env: {\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\n                    const message = liftString(wasmExports, messagePointer);\n                    lineNumber = lineNumber;\n                    columnNumber = columnNumber;\n                    (() => {\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\n                    })();\n                },\n                seed: () => {\n                    return (() => {\n                        return Date.now() * Math.random();\n                    })();\n                },\n                'console.log': (textPointer) => {\n                    console.log(liftString(wasmExports, textPointer));\n                },\n            },\n            ...wasmImports,\n        });\n        const wasmExports = instanceAndModule.instance\n            .exports;\n        return instanceAndModule.instance;\n    };\n\n    const updateWasmInOuts = (rawModule, engineData) => {\n        engineData.wasmOutput = readTypedArray(rawModule, engineData.arrayType, rawModule.getOutput());\n        engineData.wasmInput = readTypedArray(rawModule, engineData.arrayType, rawModule.getInput());\n    };\n    const createEngineLifecycleBindings = (rawModule, engineData) => {\n        return {\n            initialize: {\n                type: 'proxy',\n                value: (sampleRate, blockSize) => {\n                    engineData.metadata.audioSettings.blockSize = blockSize;\n                    engineData.metadata.audioSettings.sampleRate = sampleRate;\n                    engineData.blockSize = blockSize;\n                    rawModule.initialize(sampleRate, blockSize);\n                    updateWasmInOuts(rawModule, engineData);\n                },\n            },\n            dspLoop: {\n                type: 'proxy',\n                value: (input, output) => {\n                    for (let channel = 0; channel < input.length; channel++) {\n                        engineData.wasmInput.set(input[channel], channel * engineData.blockSize);\n                    }\n                    updateWasmInOuts(rawModule, engineData);\n                    rawModule.dspLoop();\n                    updateWasmInOuts(rawModule, engineData);\n                    for (let channel = 0; channel < output.length; channel++) {\n                        output[channel].set(engineData.wasmOutput.subarray(engineData.blockSize * channel, engineData.blockSize * (channel + 1)));\n                    }\n                },\n            },\n        };\n    };\n    const createIoMessageReceiversBindings = (rawModule, engineData) => mapObject(engineData.metadata.compilation.io.messageReceivers, (spec, nodeId) => ({\n        type: 'proxy',\n        value: mapArray(spec.portletIds, (inletId) => [\n            inletId,\n            (message) => {\n                const messagePointer = lowerMessage(rawModule, message);\n                rawModule[engineData.metadata.compilation.variableNamesIndex.io\n                    .messageReceivers[nodeId][inletId].funcName](messagePointer);\n            },\n        ]),\n    }));\n    const createIoMessageSendersBindings = (_, engineData) => mapObject(engineData.metadata.compilation.io.messageSenders, (spec) => ({\n        type: 'proxy',\n        value: mapArray(spec.portletIds, (outletId) => [\n            outletId,\n            {\n                onMessage: () => undefined,\n            },\n        ]),\n    }));\n    const ioMsgSendersImports = (forwardReferences, metadata) => {\n        const wasmImports = {};\n        const { variableNamesIndex } = metadata.compilation;\n        Object.entries(metadata.compilation.io.messageSenders).forEach(([nodeId, spec]) => {\n            spec.portletIds.forEach((outletId) => {\n                const listenerName = variableNamesIndex.io.messageSenders[nodeId][outletId].funcName;\n                wasmImports[listenerName] = (messagePointer) => {\n                    const message = liftMessage(forwardReferences.rawModule, messagePointer);\n                    forwardReferences.modules.io.messageSenders[nodeId][outletId].onMessage(message);\n                };\n            });\n        });\n        return wasmImports;\n    };\n    const readMetadata = async (wasmBuffer) => {\n        const inputImports = {};\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\n        wasmModule\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: inputImports,\n        });\n        const wasmExports = wasmInstance.exports;\n        const stringPointer = wasmExports.metadata.valueOf();\n        const metadataJSON = liftString(wasmExports, stringPointer);\n        return JSON.parse(metadataJSON);\n    };\n\n    const createFsBindings = (rawModule, engineData) => ({\n        sendReadSoundFileResponse: {\n            type: 'proxy',\n            value: (operationId, status, sound) => {\n                let soundPointer = 0;\n                if (sound) {\n                    soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\n                }\n                rawModule.x_fs_onReadSoundFileResponse(operationId, status, soundPointer);\n                updateWasmInOuts(rawModule, engineData);\n            },\n        },\n        sendWriteSoundFileResponse: {\n            type: 'proxy',\n            value: rawModule.x_fs_onWriteSoundFileResponse,\n        },\n        sendSoundStreamData: {\n            type: 'proxy',\n            value: (operationId, sound) => {\n                const soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\n                const writtenFrameCount = rawModule.x_fs_onSoundStreamData(operationId, soundPointer);\n                updateWasmInOuts(rawModule, engineData);\n                return writtenFrameCount;\n            },\n        },\n        closeSoundStream: {\n            type: 'proxy',\n            value: rawModule.x_fs_onCloseSoundStream,\n        },\n        onReadSoundFile: { type: 'callback', value: () => undefined },\n        onWriteSoundFile: { type: 'callback', value: () => undefined },\n        onOpenSoundReadStream: { type: 'callback', value: () => undefined },\n        onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\n        onSoundStreamData: { type: 'callback', value: () => undefined },\n        onCloseSoundStream: { type: 'callback', value: () => undefined },\n    });\n    const createFsImports = (forwardReferences) => {\n        let wasmImports = {\n            i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {\n                const url = liftString(forwardReferences.rawModule, urlPointer);\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\n                forwardReferences.modules.fs.onReadSoundFile(operationId, url, info);\n            },\n            i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {\n                const sound = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, soundPointer);\n                const url = liftString(forwardReferences.rawModule, urlPointer);\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\n                forwardReferences.modules.fs.onWriteSoundFile(operationId, sound, url, info);\n            },\n            i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {\n                const url = liftString(forwardReferences.rawModule, urlPointer);\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\n                updateWasmInOuts(forwardReferences.rawModule, forwardReferences.engineData);\n                forwardReferences.modules.fs.onOpenSoundReadStream(operationId, url, info);\n            },\n            i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {\n                const url = liftString(forwardReferences.rawModule, urlPointer);\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\n                forwardReferences.modules.fs.onOpenSoundWriteStream(operationId, url, info);\n            },\n            i_fs_sendSoundStreamData: (operationId, blockPointer) => {\n                const block = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, blockPointer);\n                forwardReferences.modules.fs.onSoundStreamData(operationId, block);\n            },\n            i_fs_closeSoundStream: (...args) => forwardReferences.modules.fs.onCloseSoundStream(...args),\n        };\n        return wasmImports;\n    };\n\n    const createCommonsBindings = (rawModule, engineData) => ({\n        getArray: {\n            type: 'proxy',\n            value: (arrayName) => {\n                const arrayNamePointer = lowerString(rawModule, arrayName);\n                const arrayPointer = rawModule.commons_getArray(arrayNamePointer);\n                return readTypedArray(rawModule, engineData.arrayType, arrayPointer);\n            },\n        },\n        setArray: {\n            type: 'proxy',\n            value: (arrayName, array) => {\n                const stringPointer = lowerString(rawModule, arrayName);\n                const { arrayPointer } = lowerFloatArray(rawModule, engineData.bitDepth, array);\n                rawModule.commons_setArray(stringPointer, arrayPointer);\n                updateWasmInOuts(rawModule, engineData);\n            },\n        },\n    });\n\n    const createEngine = async (wasmBuffer) => {\n        const { rawModule, engineData, forwardReferences } = await createRawModule(wasmBuffer);\n        const engineBindings = await createBindings(rawModule, engineData, forwardReferences);\n        return createModule(rawModule, engineBindings);\n    };\n    const createRawModule = async (wasmBuffer) => {\n        const metadata = await readMetadata(wasmBuffer);\n        const forwardReferences = { modules: {} };\n        const wasmImports = {\n            ...createFsImports(forwardReferences),\n            ...ioMsgSendersImports(forwardReferences, metadata),\n        };\n        const bitDepth = metadata.audioSettings.bitDepth;\n        const arrayType = getFloatArrayType(bitDepth);\n        const engineData = {\n            metadata,\n            wasmOutput: new arrayType(0),\n            wasmInput: new arrayType(0),\n            arrayType,\n            bitDepth,\n            blockSize: 0,\n        };\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: wasmImports,\n        });\n        const rawModule = wasmInstance.exports;\n        return { rawModule, engineData, forwardReferences };\n    };\n    const createBindings = async (rawModule, engineData, forwardReferences) => {\n        const commons = createModule(rawModule, createCommonsBindings(rawModule, engineData));\n        const fs = createModule(rawModule, createFsBindings(rawModule, engineData));\n        const io = {\n            messageReceivers: createModule(rawModule, createIoMessageReceiversBindings(rawModule, engineData)),\n            messageSenders: createModule(rawModule, createIoMessageSendersBindings(rawModule, engineData)),\n        };\n        forwardReferences.modules.fs = fs;\n        forwardReferences.modules.io = io;\n        forwardReferences.engineData = engineData;\n        forwardReferences.rawModule = rawModule;\n        return {\n            ...createEngineLifecycleBindings(rawModule, engineData),\n            metadata: { type: 'proxy', value: engineData.metadata },\n            commons: { type: 'proxy', value: commons },\n            fs: { type: 'proxy', value: fs },\n            io: { type: 'proxy', value: io },\n        };\n    };\n\n    exports.createBindings = createBindings;\n    exports.createEngine = createEngine;\n    exports.createRawModule = createRawModule;\n\n    return exports;\n\n})({});\n";

  var JAVA_SCRIPT_BINDINGS_CODE = "var JavaScriptBindings = (function (exports) {\n    'use strict';\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n    const createModule = (rawModule, bindings) => new Proxy({}, {\n        get: (_, k) => {\n            if (bindings.hasOwnProperty(k)) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                switch (bindingSpec.type) {\n                    case 'raw':\n                        if (k in rawModule) {\n                            return rawModule[key];\n                        }\n                        else {\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\n                        }\n                    case 'proxy':\n                    case 'callback':\n                        return bindingSpec.value;\n                }\n            }\n            else {\n                return undefined;\n            }\n        },\n        set: (_, k, newValue) => {\n            if (bindings.hasOwnProperty(String(k))) {\n                const key = String(k);\n                const bindingSpec = bindings[key];\n                if (bindingSpec.type === 'callback') {\n                    bindingSpec.value = newValue;\n                }\n                else {\n                    throw new Error(`Binding key ${String(key)} is read-only`);\n                }\n            }\n            else {\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\n            }\n            return true;\n        },\n    });\n\n    const createRawModule = (code) => new Function(`\n        ${code}\n        return exports\n    `)();\n    const createBindings = (rawModule) => ({\n        fs: { type: 'proxy', value: createFsModule(rawModule) },\n        metadata: { type: 'raw' },\n        initialize: { type: 'raw' },\n        dspLoop: { type: 'raw' },\n        io: { type: 'raw' },\n        commons: {\n            type: 'proxy',\n            value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),\n        },\n    });\n    const createEngine = (code) => {\n        const rawModule = createRawModule(code);\n        return createModule(rawModule, createBindings(rawModule));\n    };\n    const createFsModule = (rawModule) => {\n        const fs = createModule(rawModule, {\n            onReadSoundFile: { type: 'callback', value: () => undefined },\n            onWriteSoundFile: { type: 'callback', value: () => undefined },\n            onOpenSoundReadStream: { type: 'callback', value: () => undefined },\n            onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\n            onSoundStreamData: { type: 'callback', value: () => undefined },\n            onCloseSoundStream: { type: 'callback', value: () => undefined },\n            sendReadSoundFileResponse: {\n                type: 'proxy',\n                value: rawModule.x_fs_onReadSoundFileResponse,\n            },\n            sendWriteSoundFileResponse: {\n                type: 'proxy',\n                value: rawModule.x_fs_onWriteSoundFileResponse,\n            },\n            sendSoundStreamData: {\n                type: 'proxy',\n                value: rawModule.x_fs_onSoundStreamData,\n            },\n            closeSoundStream: {\n                type: 'proxy',\n                value: rawModule.x_fs_onCloseSoundStream,\n            },\n        });\n        rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);\n        rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);\n        rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);\n        rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);\n        rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);\n        rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);\n        return fs;\n    };\n    const createCommonsModule = (rawModule, bitDepth) => {\n        const floatArrayType = getFloatArrayType(bitDepth);\n        return createModule(rawModule, {\n            getArray: { type: 'proxy', value: rawModule.commons_getArray },\n            setArray: {\n                type: 'proxy',\n                value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),\n            },\n        });\n    };\n\n    exports.createBindings = createBindings;\n    exports.createEngine = createEngine;\n    exports.createRawModule = createRawModule;\n\n    return exports;\n\n})({});\n";

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
  const Var$1 = (typeName, name, value) => _preventToString$1({
      astType: 'Var',
      name,
      type: typeName,
      value: value !== undefined ? _prepareVarValue$1(value) : undefined,
  });
  const ConstVar$1 = (typeName, name, value) => _preventToString$1({
      astType: 'ConstVar',
      name,
      type: typeName,
      value: _prepareVarValue$1(value),
  });
  const Func$1 = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({
      astType: 'Func',
      name,
      args,
      returnType,
      body: ast$1(strings, ...content),
  });
  const AnonFunc$1 = (args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({
      astType: 'Func',
      name: null,
      args,
      returnType,
      body: ast$1(strings, ...content),
  });
  const Class$1 = (name, members) => _preventToString$1({
      astType: 'Class',
      name,
      members,
  });
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
      return array1
          .slice(1)
          .reduce((combinedContent, element, i) => {
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
  const _prepareVarValue$1 = (value) => {
      if (typeof value === 'number') {
          return Sequence$1([value.toString()]);
      }
      else if (typeof value === 'string') {
          return Sequence$1([value]);
      }
      else {
          return value;
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
  const bufCore$1 = () => Sequence$1([
      /**
       * Ring buffer
       */
      Class$1('buf_SoundBuffer', [
          Var$1('FloatArray', 'data'),
          Var$1('Int', 'length'),
          Var$1('Int', 'writeCursor'),
          Var$1('Int', 'pullAvailableLength'),
      ]),
      /** Erases all the content from the buffer */
      Func$1('buf_clear', [
          Var$1('buf_SoundBuffer', 'buffer')
      ], 'void') `
        buffer.data.fill(0)
    `,
      /** Erases all the content from the buffer */
      Func$1('buf_create', [
          Var$1('Int', 'length')
      ], 'buf_SoundBuffer') `
        return {
            data: createFloatArray(length),
            length: length,
            writeCursor: 0,
            pullAvailableLength: 0,
        }
    `
  ]);
  const bufPushPull$1 = {
      codeGenerator: () => Sequence$1([
          /**
           * Pushes a block to the buffer, throwing an error if the buffer is full.
           * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}
           * is moved corresponding with the length of data written.
           *
           * @todo : Optimize by allowing to read/write directly from host
           */
          Func$1('buf_pushBlock', [
              Var$1('buf_SoundBuffer', 'buffer'),
              Var$1('FloatArray', 'block')
          ], 'Int') `
            if (buffer.pullAvailableLength + block.length > buffer.length) {
                throw new Error('buffer full')
            }

            ${Var$1('Int', 'left', 'block.length')}
            while (left > 0) {
                ${ConstVar$1('Int', 'lengthToWrite', `toInt(Math.min(
                    toFloat(buffer.length - buffer.writeCursor), 
                    toFloat(left),
                ))`)}
                buffer.data.set(
                    block.subarray(
                        block.length - left, 
                        block.length - left + lengthToWrite
                    ), 
                    buffer.writeCursor
                )
                left -= lengthToWrite
                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length
                buffer.pullAvailableLength += lengthToWrite
            }
            return buffer.pullAvailableLength
        `,
          /**
           * Pulls a single sample from the buffer.
           * This is a destructive operation, and the sample will be
           * unavailable for subsequent readers with the same operation.
           */
          Func$1('buf_pullSample', [
              Var$1('buf_SoundBuffer', 'buffer')
          ], 'Float') `
            if (buffer.pullAvailableLength <= 0) {
                return 0
            }
            ${ConstVar$1('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}
            buffer.pullAvailableLength -= 1
            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]
        `
      ]),
      dependencies: [bufCore$1],
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
  const msg$1 = {
      codeGenerator: ({ settings: { target } }) => {
          // prettier-ignore
          const declareFuncs = {
              msg_create: Func$1('msg_create', [Var$1('MessageTemplate', 'template')], 'Message'),
              msg_writeStringToken: Func$1('msg_writeStringToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
                  Var$1('string', 'value'),
              ], 'void'),
              msg_writeFloatToken: Func$1('msg_writeFloatToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
                  Var$1('MessageFloatToken', 'value'),
              ], 'void'),
              msg_readStringToken: Func$1('msg_readStringToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
              ], 'string'),
              msg_readFloatToken: Func$1('msg_readFloatToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
              ], 'MessageFloatToken'),
              msg_getLength: Func$1('msg_getLength', [
                  Var$1('Message', 'message')
              ], 'Int'),
              msg_getTokenType: Func$1('msg_getTokenType', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
              ], 'Int'),
              msg_isStringToken: Func$1('msg_isStringToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
              ], 'boolean'),
              msg_isFloatToken: Func$1('msg_isFloatToken', [
                  Var$1('Message', 'message'),
                  Var$1('Int', 'tokenIndex'),
              ], 'boolean'),
              msg_isMatching: Func$1('msg_isMatching', [
                  Var$1('Message', 'message'),
                  Var$1('Array<MessageHeaderEntry>', 'tokenTypes'),
              ], 'boolean'),
              msg_floats: Func$1('msg_floats', [
                  Var$1('Array<Float>', 'values'),
              ], 'Message'),
              msg_strings: Func$1('msg_strings', [
                  Var$1('Array<string>', 'values'),
              ], 'Message'),
              msg_display: Func$1('msg_display', [
                  Var$1('Message', 'message'),
              ], 'string')
          };
          if (target === 'assemblyscript') {
              // prettier-ignore
              return Sequence$1([
                  `
                type MessageFloatToken = Float
                type MessageCharToken = Int

                type MessageTemplate = Array<Int>
                type MessageHeaderEntry = Int
                type MessageHeader = Int32Array

                type MessageHandler = (m: Message) => void
                `,
                  ConstVar$1('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),
                  ConstVar$1('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),
                  // =========================== EXPORTED API
                  Func$1('x_msg_create', [
                      Var$1('Int32Array', 'templateTypedArray')
                  ], 'Message') `
                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return msg_create(template)
                `,
                  Func$1('x_msg_getTokenTypes', [
                      Var$1('Message', 'message')
                  ], 'MessageHeader') `
                    return message.tokenTypes
                `,
                  Func$1('x_msg_createTemplate', [
                      Var$1('i32', 'length')
                  ], 'Int32Array') `
                    return new Int32Array(length)
                `,
                  // =========================== MSG API
                  declareFuncs.msg_create `
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<MessageHeaderEntry> = []
                    let tokenPositions: Array<MessageHeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case MSG_FLOAT_TOKEN:
                                byteCount += sizeof<MessageFloatToken>()
                                tokenTypes.push(MSG_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case MSG_STRING_TOKEN:
                                byteCount += sizeof<MessageCharToken>() * template[i + 1]
                                tokenTypes.push(MSG_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<MessageHeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<MessageHeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    const header = _msg_unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: _msg_unpackTokenTypes(header),
                        tokenPositions: _msg_unpackTokenPositions(header),
                    }
                `,
                  declareFuncs.msg_writeStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<MessageCharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                `,
                  declareFuncs.msg_writeFloatToken `
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                `,
                  declareFuncs.msg_readStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                    }
                    return value
                `,
                  declareFuncs.msg_readFloatToken `
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                `,
                  declareFuncs.msg_getLength `
                    return message.tokenTypes.length
                `,
                  declareFuncs.msg_getTokenType `
                    return message.tokenTypes[tokenIndex]
                `,
                  declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                `,
                  declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                `,
                  declareFuncs.msg_isMatching `
                    if (message.tokenTypes.length !== tokenTypes.length) {
                        return false
                    }
                    for (let i: Int = 0; i < tokenTypes.length; i++) {
                        if (message.tokenTypes[i] !== tokenTypes[i]) {
                            return false
                        }
                    }
                    return true
                `,
                  declareFuncs.msg_floats `
                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                `,
                  declareFuncs.msg_strings `
                    const template: MessageTemplate = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(MSG_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: Message = msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeStringToken(message, i, values[i])
                    }
                    return message
                `,
                  declareFuncs.msg_display `
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < msg_getLength(message); i++) {
                        if (msg_isFloatToken(message, i)) {
                            displayArray.push(msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                `,
                  // =========================== PRIVATE
                  // Message header : [
                  //      <Token count>, 
                  //      <Token 1 type>,  ..., <Token N type>, 
                  //      <Token 1 start>, ..., <Token N start>, <Token N end>
                  //      ... DATA ...
                  // ]
                  Class$1('Message', [
                      Var$1('DataView', 'dataView'),
                      Var$1('MessageHeader', 'header'),
                      Var$1('MessageHeaderEntry', 'tokenCount'),
                      Var$1('MessageHeader', 'tokenTypes'),
                      Var$1('MessageHeader', 'tokenPositions'),
                  ]),
                  Func$1('_msg_computeHeaderLength', [
                      Var$1('Int', 'tokenCount')
                  ], 'Int') `
                    return 1 + tokenCount * 2 + 1
                `,
                  Func$1('_msg_unpackTokenCount', [
                      Var$1('DataView', 'messageDataView')
                  ], 'MessageHeaderEntry') `
                    return messageDataView.getInt32(0)
                `,
                  Func$1('_msg_unpackHeader', [
                      Var$1('DataView', 'messageDataView'),
                      Var$1('MessageHeaderEntry', 'tokenCount'),
                  ], 'MessageHeader') `
                    const headerLength = _msg_computeHeaderLength(tokenCount)
                    // TODO : why is this \`wrap\` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                    }
                    return messageHeader
                `,
                  Func$1('_msg_unpackTokenTypes', [
                      Var$1('MessageHeader', 'header'),
                  ], 'MessageHeader') `
                    return header.slice(1, 1 + header[0])
                `,
                  Func$1('_msg_unpackTokenPositions', [
                      Var$1('MessageHeader', 'header'),
                  ], 'MessageHeader') `
                    return header.slice(1 + header[0])
                `,
              ]);
          }
          else if (target === 'javascript') {
              // prettier-ignore
              return Sequence$1([
                  ConstVar$1('string', 'MSG_FLOAT_TOKEN', '"number"'),
                  ConstVar$1('string', 'MSG_STRING_TOKEN', '"string"'),
                  declareFuncs.msg_create `
                    const m = []
                    let i = 0
                    while (i < template.length) {
                        if (template[i] === MSG_STRING_TOKEN) {
                            m.push('')
                            i += 2
                        } else if (template[i] === MSG_FLOAT_TOKEN) {
                            m.push(0)
                            i += 1
                        }
                    }
                    return m
                `,
                  declareFuncs.msg_getLength `
                    return message.length
                `,
                  declareFuncs.msg_getTokenType `
                    return typeof message[tokenIndex]
                `,
                  declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === 'string'
                `,
                  declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === 'number'
                `,
                  declareFuncs.msg_isMatching `
                    return (message.length === tokenTypes.length) 
                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])
                `,
                  declareFuncs.msg_writeFloatToken `
                    message[tokenIndex] = value
                `,
                  declareFuncs.msg_writeStringToken `
                    message[tokenIndex] = value
                `,
                  declareFuncs.msg_readFloatToken `
                    return message[tokenIndex]
                `,
                  declareFuncs.msg_readStringToken `
                    return message[tokenIndex]
                `,
                  declareFuncs.msg_floats `
                    return values
                `,
                  declareFuncs.msg_strings `
                    return values
                `,
                  declareFuncs.msg_display `
                    return '[' + message
                        .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
                        .join(', ') + ']'
                `,
              ]);
          }
          else {
              throw new Error(`Unexpected target: ${target}`);
          }
      },
      exports: [
          { name: 'x_msg_create', targets: ['assemblyscript'] },
          { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },
          { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },
          { name: 'msg_writeStringToken', targets: ['assemblyscript'] },
          { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },
          { name: 'msg_readStringToken', targets: ['assemblyscript'] },
          { name: 'msg_readFloatToken', targets: ['assemblyscript'] },
          { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },
          { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },
      ],
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
  const FS_OPERATION_SUCCESS$1 = 0;
  const FS_OPERATION_FAILURE$1 = 1;
  const fsCore$1 = {
      codeGenerator: ({ settings: { target } }) => {
          const content = [];
          if (target === 'assemblyscript') {
              content.push(`
                type fs_OperationId = Int
                type fs_OperationStatus = Int
                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void
                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void
                type fs_Url = string
            `);
          }
          // prettier-ignore
          return Sequence$1([
              ...content,
              ConstVar$1('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS$1.toString()),
              ConstVar$1('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE$1.toString()),
              ConstVar$1('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),
              ConstVar$1('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),
              ConstVar$1('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),
              // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to 
              // a function. Therefore we can get false negatives when a test happens to expect a 0.
              Var$1('Int', '_FS_OPERATION_COUNTER', '1'),
              Class$1('fs_SoundInfo', [
                  Var$1('Int', 'channelCount'),
                  Var$1('Int', 'sampleRate'),
                  Var$1('Int', 'bitDepth'),
                  Var$1('string', 'encodingFormat'),
                  Var$1('string', 'endianness'),
                  Var$1('string', 'extraOptions'),
              ]),
              Func$1('fs_soundInfoToMessage', [
                  Var$1('fs_SoundInfo', 'soundInfo')
              ], 'Message') `
                ${ConstVar$1('Message', 'info', `msg_create([
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_STRING_TOKEN,
                    soundInfo.encodingFormat.length,
                    MSG_STRING_TOKEN,
                    soundInfo.endianness.length,
                    MSG_STRING_TOKEN,
                    soundInfo.extraOptions.length
                ])`)}
                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))
                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))
                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))
                msg_writeStringToken(info, 3, soundInfo.encodingFormat)
                msg_writeStringToken(info, 4, soundInfo.endianness)
                msg_writeStringToken(info, 5, soundInfo.extraOptions)
                return info
            `,
              Func$1('_fs_assertOperationExists', [
                  Var$1('fs_OperationId', 'id'),
                  Var$1('string', 'operationName'),
              ], 'void') `
                if (!_FS_OPERATIONS_IDS.has(id)) {
                    throw new Error(operationName + ' operation unknown : ' + id.toString())
                }
            `,
              Func$1('_fs_createOperationId', [], 'fs_OperationId') `
                ${ConstVar$1('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}
                _FS_OPERATIONS_IDS.add(id)
                return id
            `
          ]);
      },
      dependencies: [msg$1],
  };
  ({
      // prettier-ignore
      codeGenerator: () => Sequence$1([
          Func$1('fs_readSoundFile', [
              Var$1('fs_Url', 'url'),
              Var$1('fs_SoundInfo', 'soundInfo'),
              Var$1('fs_OperationSoundCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)
            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func$1('x_fs_onReadSoundFileResponse', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_OperationStatus', 'status'),
              Var$1('FloatArray[]', 'sound'),
          ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)
            callback(id, status, sound)
            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onReadSoundFileResponse',
          },
      ],
      imports: [
          Func$1('i_fs_readSoundFile', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_Url', 'url'),
              Var$1('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsCore$1],
  });
  ({
      // prettier-ignore
      codeGenerator: () => Sequence$1([
          Func$1('fs_writeSoundFile', [
              Var$1('FloatArray[]', 'sound'),
              Var$1('fs_Url', 'url'),
              Var$1('fs_SoundInfo', 'soundInfo'),
              Var$1('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func$1('x_fs_onWriteSoundFileResponse', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_OperationStatus', 'status'),
          ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            ${ConstVar$1('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}
            callback(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onWriteSoundFileResponse',
          },
      ],
      imports: [
          Func$1('i_fs_writeSoundFile', [
              Var$1('fs_OperationId', 'id'),
              Var$1('FloatArray[]', 'sound'),
              Var$1('fs_Url', 'url'),
              Var$1('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsCore$1],
  });
  const fsSoundStreamCore$1 = {
      // prettier-ignore
      codeGenerator: () => Sequence$1([
          ConstVar$1('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),
          ConstVar$1('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),
          Func$1('fs_closeSoundStream', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_OperationStatus', 'status'),
          ], 'void') `
            if (!_FS_OPERATIONS_IDS.has(id)) {
                return
            }
            _FS_OPERATIONS_IDS.delete(id)
            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
            // Delete this last, to give the callback 
            // a chance to save a reference to the buffer
            // If write stream, there won't be a buffer
            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {
                _FS_SOUND_STREAM_BUFFERS.delete(id)
            }
            i_fs_closeSoundStream(id, status)
        `,
          Func$1('x_fs_onCloseSoundStream', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_OperationStatus', 'status'),
          ], 'void') `
            fs_closeSoundStream(id, status)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onCloseSoundStream',
          },
      ],
      imports: [
          Func$1('i_fs_closeSoundStream', [Var$1('fs_OperationId', 'id'), Var$1('fs_OperationStatus', 'status')], 'void') ``,
      ],
      dependencies: [bufCore$1, fsCore$1],
  };
  ({
      // prettier-ignore
      codeGenerator: () => Sequence$1([
          Func$1('fs_openSoundReadStream', [
              Var$1('fs_Url', 'url'),
              Var$1('fs_SoundInfo', 'soundInfo'),
              Var$1('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            ${ConstVar$1('Array<buf_SoundBuffer>', 'buffers', '[]')}
            for (${Var$1('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {
                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))
            }
            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func$1('x_fs_onSoundStreamData', [
              Var$1('fs_OperationId', 'id'),
              Var$1('FloatArray[]', 'block'),
          ], 'Int') `
            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')
            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)
            for (${Var$1('Int', 'i', '0')}; i < buffers.length; i++) {
                buf_pushBlock(buffers[i], block[i])
            }
            return buffers[0].pullAvailableLength
        `
      ]),
      exports: [
          {
              name: 'x_fs_onSoundStreamData',
          },
      ],
      imports: [
          Func$1('i_fs_openSoundReadStream', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_Url', 'url'),
              Var$1('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsSoundStreamCore$1, bufPushPull$1],
  });
  ({
      // prettier-ignore
      codeGenerator: () => Sequence$1([
          Func$1('fs_openSoundWriteStream', [
              Var$1('fs_Url', 'url'),
              Var$1('fs_SoundInfo', 'soundInfo'),
              Var$1('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            const id = _fs_createOperationId()
            _FS_SOUND_STREAM_BUFFERS.set(id, [])
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func$1('fs_sendSoundStreamData', [
              Var$1('fs_OperationId', 'id'),
              Var$1('FloatArray[]', 'block')
          ], 'void') `
            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')
            i_fs_sendSoundStreamData(id, block)
        `
      ]),
      imports: [
          Func$1('i_fs_openSoundWriteStream', [
              Var$1('fs_OperationId', 'id'),
              Var$1('fs_Url', 'url'),
              Var$1('Message', 'info'),
          ], 'void') ``,
          Func$1('i_fs_sendSoundStreamData', [Var$1('fs_OperationId', 'id'), Var$1('FloatArray[]', 'block')], 'void') ``,
      ],
      dependencies: [fsSoundStreamCore$1],
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
  AnonFunc$1([Var$1('Message', 'm')], 'void') ``;

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
          let operationStatus = FS_OPERATION_SUCCESS$1;
          let sound = null;
          try {
              sound = await fakeFs.readSound(absoluteUrl, node.context);
          }
          catch (err) {
              operationStatus = FS_OPERATION_FAILURE$1;
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
                      arguments: [operationId, FS_OPERATION_FAILURE$1],
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
                      arguments: [operationId, FS_OPERATION_SUCCESS$1],
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
          let operationStatus = FS_OPERATION_SUCCESS$1;
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
      const { payload } = message;
      if (message.type !== 'fs') {
          throw new Error(`Unknown message type from node ${message.type}`);
      }
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
  const Var = (typeName, name, value) => _preventToString({
      astType: 'Var',
      name,
      type: typeName,
      value: value !== undefined ? _prepareVarValue(value) : undefined,
  });
  const ConstVar = (typeName, name, value) => _preventToString({
      astType: 'ConstVar',
      name,
      type: typeName,
      value: _prepareVarValue(value),
  });
  const Func = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString({
      astType: 'Func',
      name,
      args,
      returnType,
      body: ast(strings, ...content),
  });
  const AnonFunc = (args = [], returnType = 'void') => (strings, ...content) => _preventToString({
      astType: 'Func',
      name: null,
      args,
      returnType,
      body: ast(strings, ...content),
  });
  const Class = (name, members) => _preventToString({
      astType: 'Class',
      name,
      members,
  });
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
      return array1
          .slice(1)
          .reduce((combinedContent, element, i) => {
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
  const _prepareVarValue = (value) => {
      if (typeof value === 'number') {
          return Sequence([value.toString()]);
      }
      else if (typeof value === 'string') {
          return Sequence([value]);
      }
      else {
          return value;
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
      const path = _defaultPath(_path);
      return {
          keys: [...path.keys, key],
          parents: [...path.parents, parent],
      };
  };
  const _defaultPath = (path) => path || {
      keys: [],
      parents: [],
  };
  const _proxySetHandlerReadOnly = () => {
      throw new Error('This Proxy is read-only.');
  };
  const _proxyGetHandlerThrowIfKeyUnknown = (target, key, path) => {
      if (!target.hasOwnProperty(key)) {
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
          ].includes(key)) {
              return true;
          }
          throw new Error(`namespace${path ? ` <${path.keys.join('.')}>` : ''} doesn't know key "${String(key)}"`);
      }
      return false;
  };
  const Assigner = (spec, context, _obj, _path) => {
      const path = _path || { keys: [], parents: [] };
      const obj = Assigner.ensureValue(_obj, spec, undefined, path);
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
                  nextSpec = spec.Index(key, context);
              }
              else if ('Interface' in spec) {
                  nextSpec = spec.Interface[key];
              }
              else {
                  throw new Error('no builder');
              }
              return Assigner(nextSpec, context, 
              // We use this form here instead of `obj[key]` specifically
              // to allow Assign to play well with `ProtectedIndex`, which
              // would raise an error if trying to access an undefined key.
              key in obj ? obj[key] : undefined, _addPath(obj, String(key), path));
          },
          set: _proxySetHandlerReadOnly,
      });
  };
  Assigner.ensureValue = (_obj, spec, _recursionPath, _path) => {
      if ('Index' in spec) {
          return (_obj || spec.indexConstructor(_defaultPath(_path)));
      }
      else if ('Interface' in spec) {
          const obj = (_obj || {});
          Object.entries(spec.Interface).forEach(([key, nextSpec]) => {
              obj[key] = Assigner.ensureValue(obj[key], nextSpec, _addPath(obj, key, _recursionPath), _addPath(obj, key, _path));
          });
          return obj;
      }
      else if ('Literal' in spec) {
          return (_obj || spec.Literal(_defaultPath(_path)));
      }
      else if ('LiteralDefaultNull' in spec) {
          if (!_recursionPath) {
              return (_obj || spec.LiteralDefaultNull());
          }
          else {
              return (_obj || null);
          }
      }
      else {
          throw new Error('Invalid Assigner');
      }
  };
  Assigner.Interface = (a) => ({ Interface: a });
  Assigner.Index = (f, indexConstructor) => ({
      Index: f,
      indexConstructor: indexConstructor || (() => ({})),
  });
  Assigner.Literal = (f) => ({
      Literal: f,
  });
  Assigner.LiteralDefaultNull = (f) => ({ LiteralDefaultNull: f });
  // ---------------------------- ProtectedIndex ---------------------------- //
  /**
   * Helper to declare namespace objects enforcing stricter access rules.
   * Specifically, it forbids :
   * - reading an unknown property.
   * - trying to overwrite an existing property.
   */
  const ProtectedIndex = (namespace, path) => {
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

  Assigner.Interface({
      nodes: Assigner.Index((nodeId) => Assigner.Interface({
          signalOuts: Assigner.Index((portletId) => Assigner.Literal(() => `${_v(nodeId)}_OUTS_${_v(portletId)}`)),
          messageSenders: Assigner.Index((portletId) => Assigner.Literal(() => `${_v(nodeId)}_SNDS_${_v(portletId)}`)),
          messageReceivers: Assigner.Index((portletId) => Assigner.Literal(() => `${_v(nodeId)}_RCVS_${_v(portletId)}`)),
          state: Assigner.LiteralDefaultNull(() => `${_v(nodeId)}_STATE`),
      })),
      nodeImplementations: Assigner.Index((nodeType, { nodeImplementations }) => {
          const nodeImplementation = getNodeImplementation(nodeImplementations, nodeType);
          return Assigner.Interface({
              stateClass: Assigner.LiteralDefaultNull(() => `State_${_v((nodeImplementation.flags
                ? nodeImplementation.flags.alphaName
                : null) || nodeType)}`),
          });
      }),
      /** Namespace for global variables */
      globs: Assigner.Literal(() => ({
          iterFrame: 'F',
          frame: 'FRAME',
          blockSize: 'BLOCK_SIZE',
          sampleRate: 'SAMPLE_RATE',
          output: 'OUTPUT',
          input: 'INPUT',
          nullMessageReceiver: 'SND_TO_NULL',
          nullSignal: 'NULL_SIGNAL',
          emptyMessage: 'EMPTY_MESSAGE',
      })),
      io: Assigner.Interface({
          messageReceivers: Assigner.Index((nodeId) => Assigner.Index((inletId) => Assigner.Literal(() => `ioRcv_${nodeId}_${inletId}`))),
          messageSenders: Assigner.Index((nodeId) => Assigner.Index((outletId) => Assigner.Literal(() => `ioSnd_${nodeId}_${outletId}`))),
      }),
      coldDspGroups: Assigner.Index((groupId) => Assigner.Literal(() => `coldDsp_${groupId}`)),
  });
  Assigner.Interface({
      graph: Assigner.Literal((path) => ({
          fullTraversal: [],
          hotDspGroup: {
              traversal: [],
              outNodesIds: [],
          },
          coldDspGroups: ProtectedIndex({}, path),
      })),
      nodeImplementations: Assigner.Index((nodeType, { nodeImplementations }) => Assigner.Literal(() => ({
          nodeImplementation: getNodeImplementation(nodeImplementations, nodeType),
          stateClass: null,
          core: null,
      })), (path) => ProtectedIndex({}, path)),
      nodes: Assigner.Index((nodeId, { graph }) => Assigner.Literal(() => ({
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
      })), (path) => ProtectedIndex({}, path)),
      dependencies: Assigner.Literal(() => ({
          imports: [],
          exports: [],
          ast: Sequence([]),
      })),
      io: Assigner.Interface({
          messageReceivers: Assigner.Index((_) => Assigner.Literal(() => ({})), (path) => ProtectedIndex({}, path)),
          messageSenders: Assigner.Index((_) => Assigner.Literal(() => ({})), (path) => ProtectedIndex({}, path)),
      }),
  });
  const assertValidNamePart = (namePart) => {
      const isInvalid = !VALID_NAME_PART_REGEXP.exec(namePart);
      if (isInvalid) {
          throw new Error(`Invalid variable name for code generation "${namePart}"`);
      }
      return namePart;
  };
  const _v = assertValidNamePart;
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
  const bufCore = () => Sequence([
      /**
       * Ring buffer
       */
      Class('buf_SoundBuffer', [
          Var('FloatArray', 'data'),
          Var('Int', 'length'),
          Var('Int', 'writeCursor'),
          Var('Int', 'pullAvailableLength'),
      ]),
      /** Erases all the content from the buffer */
      Func('buf_clear', [
          Var('buf_SoundBuffer', 'buffer')
      ], 'void') `
        buffer.data.fill(0)
    `,
      /** Erases all the content from the buffer */
      Func('buf_create', [
          Var('Int', 'length')
      ], 'buf_SoundBuffer') `
        return {
            data: createFloatArray(length),
            length: length,
            writeCursor: 0,
            pullAvailableLength: 0,
        }
    `
  ]);
  const bufPushPull = {
      codeGenerator: () => Sequence([
          /**
           * Pushes a block to the buffer, throwing an error if the buffer is full.
           * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}
           * is moved corresponding with the length of data written.
           *
           * @todo : Optimize by allowing to read/write directly from host
           */
          Func('buf_pushBlock', [
              Var('buf_SoundBuffer', 'buffer'),
              Var('FloatArray', 'block')
          ], 'Int') `
            if (buffer.pullAvailableLength + block.length > buffer.length) {
                throw new Error('buffer full')
            }

            ${Var('Int', 'left', 'block.length')}
            while (left > 0) {
                ${ConstVar('Int', 'lengthToWrite', `toInt(Math.min(
                    toFloat(buffer.length - buffer.writeCursor), 
                    toFloat(left),
                ))`)}
                buffer.data.set(
                    block.subarray(
                        block.length - left, 
                        block.length - left + lengthToWrite
                    ), 
                    buffer.writeCursor
                )
                left -= lengthToWrite
                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length
                buffer.pullAvailableLength += lengthToWrite
            }
            return buffer.pullAvailableLength
        `,
          /**
           * Pulls a single sample from the buffer.
           * This is a destructive operation, and the sample will be
           * unavailable for subsequent readers with the same operation.
           */
          Func('buf_pullSample', [
              Var('buf_SoundBuffer', 'buffer')
          ], 'Float') `
            if (buffer.pullAvailableLength <= 0) {
                return 0
            }
            ${ConstVar('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}
            buffer.pullAvailableLength -= 1
            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]
        `
      ]),
      dependencies: [bufCore],
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
  const msg = {
      codeGenerator: ({ settings: { target } }) => {
          // prettier-ignore
          const declareFuncs = {
              msg_create: Func('msg_create', [Var('MessageTemplate', 'template')], 'Message'),
              msg_writeStringToken: Func('msg_writeStringToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
                  Var('string', 'value'),
              ], 'void'),
              msg_writeFloatToken: Func('msg_writeFloatToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
                  Var('MessageFloatToken', 'value'),
              ], 'void'),
              msg_readStringToken: Func('msg_readStringToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
              ], 'string'),
              msg_readFloatToken: Func('msg_readFloatToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
              ], 'MessageFloatToken'),
              msg_getLength: Func('msg_getLength', [
                  Var('Message', 'message')
              ], 'Int'),
              msg_getTokenType: Func('msg_getTokenType', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
              ], 'Int'),
              msg_isStringToken: Func('msg_isStringToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
              ], 'boolean'),
              msg_isFloatToken: Func('msg_isFloatToken', [
                  Var('Message', 'message'),
                  Var('Int', 'tokenIndex'),
              ], 'boolean'),
              msg_isMatching: Func('msg_isMatching', [
                  Var('Message', 'message'),
                  Var('Array<MessageHeaderEntry>', 'tokenTypes'),
              ], 'boolean'),
              msg_floats: Func('msg_floats', [
                  Var('Array<Float>', 'values'),
              ], 'Message'),
              msg_strings: Func('msg_strings', [
                  Var('Array<string>', 'values'),
              ], 'Message'),
              msg_display: Func('msg_display', [
                  Var('Message', 'message'),
              ], 'string')
          };
          if (target === 'assemblyscript') {
              // prettier-ignore
              return Sequence([
                  `
                type MessageFloatToken = Float
                type MessageCharToken = Int

                type MessageTemplate = Array<Int>
                type MessageHeaderEntry = Int
                type MessageHeader = Int32Array

                type MessageHandler = (m: Message) => void
                `,
                  ConstVar('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),
                  ConstVar('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),
                  // =========================== EXPORTED API
                  Func('x_msg_create', [
                      Var('Int32Array', 'templateTypedArray')
                  ], 'Message') `
                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return msg_create(template)
                `,
                  Func('x_msg_getTokenTypes', [
                      Var('Message', 'message')
                  ], 'MessageHeader') `
                    return message.tokenTypes
                `,
                  Func('x_msg_createTemplate', [
                      Var('i32', 'length')
                  ], 'Int32Array') `
                    return new Int32Array(length)
                `,
                  // =========================== MSG API
                  declareFuncs.msg_create `
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<MessageHeaderEntry> = []
                    let tokenPositions: Array<MessageHeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case MSG_FLOAT_TOKEN:
                                byteCount += sizeof<MessageFloatToken>()
                                tokenTypes.push(MSG_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case MSG_STRING_TOKEN:
                                byteCount += sizeof<MessageCharToken>() * template[i + 1]
                                tokenTypes.push(MSG_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<MessageHeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<MessageHeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    const header = _msg_unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: _msg_unpackTokenTypes(header),
                        tokenPositions: _msg_unpackTokenPositions(header),
                    }
                `,
                  declareFuncs.msg_writeStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<MessageCharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                `,
                  declareFuncs.msg_writeFloatToken `
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                `,
                  declareFuncs.msg_readStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                    }
                    return value
                `,
                  declareFuncs.msg_readFloatToken `
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                `,
                  declareFuncs.msg_getLength `
                    return message.tokenTypes.length
                `,
                  declareFuncs.msg_getTokenType `
                    return message.tokenTypes[tokenIndex]
                `,
                  declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                `,
                  declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                `,
                  declareFuncs.msg_isMatching `
                    if (message.tokenTypes.length !== tokenTypes.length) {
                        return false
                    }
                    for (let i: Int = 0; i < tokenTypes.length; i++) {
                        if (message.tokenTypes[i] !== tokenTypes[i]) {
                            return false
                        }
                    }
                    return true
                `,
                  declareFuncs.msg_floats `
                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                `,
                  declareFuncs.msg_strings `
                    const template: MessageTemplate = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(MSG_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: Message = msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeStringToken(message, i, values[i])
                    }
                    return message
                `,
                  declareFuncs.msg_display `
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < msg_getLength(message); i++) {
                        if (msg_isFloatToken(message, i)) {
                            displayArray.push(msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                `,
                  // =========================== PRIVATE
                  // Message header : [
                  //      <Token count>, 
                  //      <Token 1 type>,  ..., <Token N type>, 
                  //      <Token 1 start>, ..., <Token N start>, <Token N end>
                  //      ... DATA ...
                  // ]
                  Class('Message', [
                      Var('DataView', 'dataView'),
                      Var('MessageHeader', 'header'),
                      Var('MessageHeaderEntry', 'tokenCount'),
                      Var('MessageHeader', 'tokenTypes'),
                      Var('MessageHeader', 'tokenPositions'),
                  ]),
                  Func('_msg_computeHeaderLength', [
                      Var('Int', 'tokenCount')
                  ], 'Int') `
                    return 1 + tokenCount * 2 + 1
                `,
                  Func('_msg_unpackTokenCount', [
                      Var('DataView', 'messageDataView')
                  ], 'MessageHeaderEntry') `
                    return messageDataView.getInt32(0)
                `,
                  Func('_msg_unpackHeader', [
                      Var('DataView', 'messageDataView'),
                      Var('MessageHeaderEntry', 'tokenCount'),
                  ], 'MessageHeader') `
                    const headerLength = _msg_computeHeaderLength(tokenCount)
                    // TODO : why is this \`wrap\` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                    }
                    return messageHeader
                `,
                  Func('_msg_unpackTokenTypes', [
                      Var('MessageHeader', 'header'),
                  ], 'MessageHeader') `
                    return header.slice(1, 1 + header[0])
                `,
                  Func('_msg_unpackTokenPositions', [
                      Var('MessageHeader', 'header'),
                  ], 'MessageHeader') `
                    return header.slice(1 + header[0])
                `,
              ]);
          }
          else if (target === 'javascript') {
              // prettier-ignore
              return Sequence([
                  ConstVar('string', 'MSG_FLOAT_TOKEN', '"number"'),
                  ConstVar('string', 'MSG_STRING_TOKEN', '"string"'),
                  declareFuncs.msg_create `
                    const m = []
                    let i = 0
                    while (i < template.length) {
                        if (template[i] === MSG_STRING_TOKEN) {
                            m.push('')
                            i += 2
                        } else if (template[i] === MSG_FLOAT_TOKEN) {
                            m.push(0)
                            i += 1
                        }
                    }
                    return m
                `,
                  declareFuncs.msg_getLength `
                    return message.length
                `,
                  declareFuncs.msg_getTokenType `
                    return typeof message[tokenIndex]
                `,
                  declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === 'string'
                `,
                  declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === 'number'
                `,
                  declareFuncs.msg_isMatching `
                    return (message.length === tokenTypes.length) 
                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])
                `,
                  declareFuncs.msg_writeFloatToken `
                    message[tokenIndex] = value
                `,
                  declareFuncs.msg_writeStringToken `
                    message[tokenIndex] = value
                `,
                  declareFuncs.msg_readFloatToken `
                    return message[tokenIndex]
                `,
                  declareFuncs.msg_readStringToken `
                    return message[tokenIndex]
                `,
                  declareFuncs.msg_floats `
                    return values
                `,
                  declareFuncs.msg_strings `
                    return values
                `,
                  declareFuncs.msg_display `
                    return '[' + message
                        .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
                        .join(', ') + ']'
                `,
              ]);
          }
          else {
              throw new Error(`Unexpected target: ${target}`);
          }
      },
      exports: [
          { name: 'x_msg_create', targets: ['assemblyscript'] },
          { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },
          { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },
          { name: 'msg_writeStringToken', targets: ['assemblyscript'] },
          { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },
          { name: 'msg_readStringToken', targets: ['assemblyscript'] },
          { name: 'msg_readFloatToken', targets: ['assemblyscript'] },
          { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },
          { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },
      ],
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
  const FS_OPERATION_SUCCESS = 0;
  const FS_OPERATION_FAILURE = 1;
  const fsCore = {
      codeGenerator: ({ settings: { target } }) => {
          const content = [];
          if (target === 'assemblyscript') {
              content.push(`
                type fs_OperationId = Int
                type fs_OperationStatus = Int
                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void
                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void
                type fs_Url = string
            `);
          }
          // prettier-ignore
          return Sequence([
              ...content,
              ConstVar('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS.toString()),
              ConstVar('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE.toString()),
              ConstVar('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),
              ConstVar('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),
              ConstVar('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),
              // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to 
              // a function. Therefore we can get false negatives when a test happens to expect a 0.
              Var('Int', '_FS_OPERATION_COUNTER', '1'),
              Class('fs_SoundInfo', [
                  Var('Int', 'channelCount'),
                  Var('Int', 'sampleRate'),
                  Var('Int', 'bitDepth'),
                  Var('string', 'encodingFormat'),
                  Var('string', 'endianness'),
                  Var('string', 'extraOptions'),
              ]),
              Func('fs_soundInfoToMessage', [
                  Var('fs_SoundInfo', 'soundInfo')
              ], 'Message') `
                ${ConstVar('Message', 'info', `msg_create([
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_STRING_TOKEN,
                    soundInfo.encodingFormat.length,
                    MSG_STRING_TOKEN,
                    soundInfo.endianness.length,
                    MSG_STRING_TOKEN,
                    soundInfo.extraOptions.length
                ])`)}
                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))
                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))
                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))
                msg_writeStringToken(info, 3, soundInfo.encodingFormat)
                msg_writeStringToken(info, 4, soundInfo.endianness)
                msg_writeStringToken(info, 5, soundInfo.extraOptions)
                return info
            `,
              Func('_fs_assertOperationExists', [
                  Var('fs_OperationId', 'id'),
                  Var('string', 'operationName'),
              ], 'void') `
                if (!_FS_OPERATIONS_IDS.has(id)) {
                    throw new Error(operationName + ' operation unknown : ' + id.toString())
                }
            `,
              Func('_fs_createOperationId', [], 'fs_OperationId') `
                ${ConstVar('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}
                _FS_OPERATIONS_IDS.add(id)
                return id
            `
          ]);
      },
      dependencies: [msg],
  };
  ({
      // prettier-ignore
      codeGenerator: () => Sequence([
          Func('fs_readSoundFile', [
              Var('fs_Url', 'url'),
              Var('fs_SoundInfo', 'soundInfo'),
              Var('fs_OperationSoundCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)
            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func('x_fs_onReadSoundFileResponse', [
              Var('fs_OperationId', 'id'),
              Var('fs_OperationStatus', 'status'),
              Var('FloatArray[]', 'sound'),
          ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)
            callback(id, status, sound)
            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onReadSoundFileResponse',
          },
      ],
      imports: [
          Func('i_fs_readSoundFile', [
              Var('fs_OperationId', 'id'),
              Var('fs_Url', 'url'),
              Var('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsCore],
  });
  ({
      // prettier-ignore
      codeGenerator: () => Sequence([
          Func('fs_writeSoundFile', [
              Var('FloatArray[]', 'sound'),
              Var('fs_Url', 'url'),
              Var('fs_SoundInfo', 'soundInfo'),
              Var('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func('x_fs_onWriteSoundFileResponse', [
              Var('fs_OperationId', 'id'),
              Var('fs_OperationStatus', 'status'),
          ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            ${ConstVar('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}
            callback(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onWriteSoundFileResponse',
          },
      ],
      imports: [
          Func('i_fs_writeSoundFile', [
              Var('fs_OperationId', 'id'),
              Var('FloatArray[]', 'sound'),
              Var('fs_Url', 'url'),
              Var('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsCore],
  });
  const fsSoundStreamCore = {
      // prettier-ignore
      codeGenerator: () => Sequence([
          ConstVar('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),
          ConstVar('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),
          Func('fs_closeSoundStream', [
              Var('fs_OperationId', 'id'),
              Var('fs_OperationStatus', 'status'),
          ], 'void') `
            if (!_FS_OPERATIONS_IDS.has(id)) {
                return
            }
            _FS_OPERATIONS_IDS.delete(id)
            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
            // Delete this last, to give the callback 
            // a chance to save a reference to the buffer
            // If write stream, there won't be a buffer
            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {
                _FS_SOUND_STREAM_BUFFERS.delete(id)
            }
            i_fs_closeSoundStream(id, status)
        `,
          Func('x_fs_onCloseSoundStream', [
              Var('fs_OperationId', 'id'),
              Var('fs_OperationStatus', 'status'),
          ], 'void') `
            fs_closeSoundStream(id, status)
        `
      ]),
      exports: [
          {
              name: 'x_fs_onCloseSoundStream',
          },
      ],
      imports: [
          Func('i_fs_closeSoundStream', [Var('fs_OperationId', 'id'), Var('fs_OperationStatus', 'status')], 'void') ``,
      ],
      dependencies: [bufCore, fsCore],
  };
  ({
      // prettier-ignore
      codeGenerator: () => Sequence([
          Func('fs_openSoundReadStream', [
              Var('fs_Url', 'url'),
              Var('fs_SoundInfo', 'soundInfo'),
              Var('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            ${ConstVar('Array<buf_SoundBuffer>', 'buffers', '[]')}
            for (${Var('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {
                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))
            }
            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func('x_fs_onSoundStreamData', [
              Var('fs_OperationId', 'id'),
              Var('FloatArray[]', 'block'),
          ], 'Int') `
            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')
            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)
            for (${Var('Int', 'i', '0')}; i < buffers.length; i++) {
                buf_pushBlock(buffers[i], block[i])
            }
            return buffers[0].pullAvailableLength
        `
      ]),
      exports: [
          {
              name: 'x_fs_onSoundStreamData',
          },
      ],
      imports: [
          Func('i_fs_openSoundReadStream', [
              Var('fs_OperationId', 'id'),
              Var('fs_Url', 'url'),
              Var('Message', 'info'),
          ], 'void') ``,
      ],
      dependencies: [fsSoundStreamCore, bufPushPull],
  });
  ({
      // prettier-ignore
      codeGenerator: () => Sequence([
          Func('fs_openSoundWriteStream', [
              Var('fs_Url', 'url'),
              Var('fs_SoundInfo', 'soundInfo'),
              Var('fs_OperationCallback', 'callback'),
          ], 'fs_OperationId') `
            const id = _fs_createOperationId()
            _FS_SOUND_STREAM_BUFFERS.set(id, [])
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
          Func('fs_sendSoundStreamData', [
              Var('fs_OperationId', 'id'),
              Var('FloatArray[]', 'block')
          ], 'void') `
            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')
            i_fs_sendSoundStreamData(id, block)
        `
      ]),
      imports: [
          Func('i_fs_openSoundWriteStream', [
              Var('fs_OperationId', 'id'),
              Var('fs_Url', 'url'),
              Var('Message', 'info'),
          ], 'void') ``,
          Func('i_fs_sendSoundStreamData', [Var('fs_OperationId', 'id'), Var('FloatArray[]', 'block')], 'void') ``,
      ],
      dependencies: [fsSoundStreamCore],
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
  AnonFunc([Var('Message', 'm')], 'void') ``;

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
  /** Helper to create a Module by wrapping a RawModule with Bindings */
  const createModule = (rawModule, bindings) => 
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
  const liftString = (wasmExports, pointer) => {
      if (!pointer) {
          throw new Error('Cannot lift a null pointer');
      }
      pointer = pointer >>> 0;
      const end = (pointer +
          new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>
          1;
      const memoryU16 = new Uint16Array(wasmExports.memory.buffer);
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
      const wasmExports = wasmInstance.exports;
      const stringPointer = wasmExports.metadata.valueOf();
      const metadataJSON = liftString(wasmExports, stringPointer);
      return JSON.parse(metadataJSON);
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
  const createRawModule = (code) => new Function(`
        ${code}
        return exports
    `)();
  const createBindings = (rawModule) => ({
      fs: { type: 'proxy', value: createFsModule(rawModule) },
      metadata: { type: 'raw' },
      initialize: { type: 'raw' },
      dspLoop: { type: 'raw' },
      io: { type: 'raw' },
      commons: {
          type: 'proxy',
          value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),
      },
  });
  const createEngine = (code) => {
      const rawModule = createRawModule(code);
      return createModule(rawModule, createBindings(rawModule));
  };
  const createFsModule = (rawModule) => {
      const fs = createModule(rawModule, {
          onReadSoundFile: { type: 'callback', value: () => undefined },
          onWriteSoundFile: { type: 'callback', value: () => undefined },
          onOpenSoundReadStream: { type: 'callback', value: () => undefined },
          onOpenSoundWriteStream: { type: 'callback', value: () => undefined },
          onSoundStreamData: { type: 'callback', value: () => undefined },
          onCloseSoundStream: { type: 'callback', value: () => undefined },
          sendReadSoundFileResponse: {
              type: 'proxy',
              value: rawModule.x_fs_onReadSoundFileResponse,
          },
          sendWriteSoundFileResponse: {
              type: 'proxy',
              value: rawModule.x_fs_onWriteSoundFileResponse,
          },
          sendSoundStreamData: {
              type: 'proxy',
              value: rawModule.x_fs_onSoundStreamData,
          },
          closeSoundStream: {
              type: 'proxy',
              value: rawModule.x_fs_onCloseSoundStream,
          },
      });
      rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);
      rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);
      rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);
      rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);
      rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);
      rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);
      return fs;
  };
  const createCommonsModule = (rawModule, bitDepth) => {
      const floatArrayType = getFloatArrayType(bitDepth);
      return createModule(rawModule, {
          getArray: { type: 'proxy', value: rawModule.commons_getArray },
          setArray: {
              type: 'proxy',
              value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),
          },
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

  const defaultSettingsForRun = (patchUrl) => {
      const rootUrl = urlDirName(patchUrl);
      return {
          messageHandler: (node, message) => index(node, message, { rootUrl }),
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
