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

import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { parseSoundFileOpenOpts } from '../global-code/fs'
import { stdlib } from '@webpd/compiler'
import { AnonFunc, Class, ConstVar, Func, Var, ast } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {}
const stateVariables = {
    operations: 1,
    buildMessage1: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO: Implement -normalize for write operation
// TODO: Implement output headersize
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const sharedCode: GlobalCodeGenerator = () => 
    Class('SoundfilerOperation', [
        Var('string', 'url'),
        Var('Array<string>', 'arrayNames'),
        Var('boolean', 'resize'),
        Var('Float', 'maxSize'),
        Var('Float', 'framesToWrite'),
        Var('Float', 'skip'),
        Var('fs_SoundInfo', 'soundInfo'),
    ])

const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ state }) => ast`
    ${ConstVar('Map<fs_OperationId, SoundfilerOperation>', state.operations, 'new Map()')}

    ${Func(state.buildMessage1, [
        Var('fs_SoundInfo', 'soundInfo')
    ], 'Message')`
        ${ConstVar('Message', 'm', `msg_create([
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_STRING_TOKEN,
            soundInfo.endianness.length,
        ])`)}
        msg_writeFloatToken(m, 0, toFloat(soundInfo.sampleRate))
        msg_writeFloatToken(m, 1, -1) // TODO IMPLEMENT headersize
        msg_writeFloatToken(m, 2, toFloat(soundInfo.channelCount))
        msg_writeFloatToken(m, 3, Math.round(toFloat(soundInfo.bitDepth) / 8))
        msg_writeStringToken(m, 4, soundInfo.endianness)
        return m
    `}
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs, snds }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (
            msg_getLength(m) >= 3 
            && msg_isStringToken(m, 0)
            && (
                msg_readStringToken(m, 0) === 'read'
                || msg_readStringToken(m, 0) === 'write'
            )
        ) {
            ${ConstVar('string', 'operationType', `msg_readStringToken(m, 0)`)}
            ${ConstVar('fs_SoundInfo', 'soundInfo', `{
                channelCount: 0,
                sampleRate: toInt(${globs.sampleRate}),
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }`)}
            ${ConstVar('SoundfilerOperation', 'operation', `{
                arrayNames: [],
                resize: false,
                maxSize: -1,
                skip: 0,
                framesToWrite: 0,
                url: '',
                soundInfo,
            }`)}
            ${Var('Set<Int>', 'unhandledOptions', `parseSoundFileOpenOpts(
                m,
                soundInfo,
            )`)}
            
            // Remove the operation type
            unhandledOptions.delete(0)
            
            ${Var('Int', 'i', '1')}
            ${Var('string', 'str', '""')}
            while (i < msg_getLength(m)) {
                if (!unhandledOptions.has(i)) {

                } else if (msg_isStringToken(m, i)) {
                    str = msg_readStringToken(m, i)
                    if (str === '-resize') {
                        unhandledOptions.delete(i)
                        operation.resize = true

                    } else if (str === '-maxsize' || str === '-nframes') {
                        unhandledOptions.delete(i)
                        if (
                            i + 1 >= msg_getLength(m) 
                            || !msg_isFloatToken(m, i + 1)
                        ) {
                            console.log("invalid value for -maxsize")
                        }
                        operation.maxSize = msg_readFloatToken(m, i + 1)
                        unhandledOptions.delete(i + 1)
                        i++

                    } else if (str === '-skip') {
                        unhandledOptions.delete(i)
                        if (
                            i + 1 >= msg_getLength(m) 
                            || !msg_isFloatToken(m, i + 1)
                        ) {
                            console.log("invalid value for -skip")
                        }
                        operation.skip = msg_readFloatToken(m, i + 1)
                        unhandledOptions.delete(i + 1)
                        i++

                    } else if (str === '-normalize') {
                        unhandledOptions.delete(i)
                        console.log('-normalize not implemented')
                    }
                }
                i++
            }

            i = 1
            ${Var('boolean', 'urlFound', 'false')}
            while (i < msg_getLength(m)) {
                if (!unhandledOptions.has(i)) {

                } else if (msg_isStringToken(m, i)) {
                    str = msg_readStringToken(m, i)
                    if (!str.startsWith('-') && urlFound === false) {
                        operation.url = str
                        urlFound = true
                    } else {
                        operation.arrayNames.push(str)
                    }
                    unhandledOptions.delete(i)
                }
                i++
            }

            for (i = 0; i < operation.arrayNames.length; i++) {
                if (!commons_hasArray(operation.arrayNames[i])) {
                    console.log('[soundfiler] unknown array ' + operation.arrayNames[i])
                    return
                }
            }

            if (unhandledOptions.size) {
                console.log("soundfiler received invalid options")
            }

            soundInfo.channelCount = operation.arrayNames.length

            if (operationType === 'read') {
                ${ConstVar('fs_OperationId', 'id', ast`fs_readSoundFile(
                    operation.url, 
                    soundInfo,
                    ${AnonFunc([
                        Var('fs_OperationId', 'id'),
                        Var('fs_OperationStatus', 'status'),
                        Var('FloatArray[]', 'sound'),
                    ], 'void')`
                        ${ConstVar('SoundfilerOperation', 'operation', `${state.operations}.get(id)`)}
                        ${state.operations}.delete(id)
                        ${Var('Int', 'i', '0')}
                        ${Var('Float', 'maxFramesRead', '0')}
                        ${Var('Float', 'framesToRead', '0')}
                        ${Var('FloatArray', 'array', 'createFloatArray(0)')}
                        for (i = 0; i < sound.length; i++) {
                            if (operation.resize) {
                                if (operation.maxSize > 0) {
                                    framesToRead = Math.min(
                                        operation.maxSize, 
                                        toFloat(sound[i].length) - operation.skip
                                    )
    
                                } else {
                                    framesToRead = toFloat(sound[i].length) - operation.skip
                                }
    
                                commons_setArray(
                                    operation.arrayNames[i], 
                                    sound[i].subarray(
                                        toInt(operation.skip), 
                                        toInt(operation.skip + framesToRead)
                                    )
                                )
                                
                            } else {
                                array = commons_getArray(operation.arrayNames[i])
                                framesToRead = Math.min(
                                    toFloat(array.length),
                                    toFloat(sound[i].length) - operation.skip
                                )
                                array.set(sound[i].subarray(0, array.length))
                            }
                            maxFramesRead = Math.max(
                                maxFramesRead,
                                framesToRead
                            )
                        }
    
                        ${snds.$1}(${state.buildMessage1}(operation.soundInfo))
                        ${snds.$0}(msg_floats([maxFramesRead]))
                    `}
                )`)}

                ${state.operations}.set(id, operation)

            } else if (operationType === 'write') {
                ${Var('Int', 'i', '0')}
                ${Var('Float', 'framesToWrite', '0')}
                ${Var('FloatArray', 'array', 'createFloatArray(0)')}
                ${ConstVar('FloatArray[]', 'sound', '[]')}
                
                for (i = 0; i < operation.arrayNames.length; i++) {
                    framesToWrite = Math.max(
                        framesToWrite,
                        toFloat(commons_getArray(operation.arrayNames[i]).length) - operation.skip,
                    )
                }

                if (operation.maxSize >= 0) {
                    framesToWrite = Math.min(
                        operation.maxSize, 
                        framesToWrite
                    )
                }
                operation.framesToWrite = framesToWrite

                if (framesToWrite < 1) {
                    console.log('[soundfiler] no frames to write')
                    return
                }

                for (i = 0; i < operation.arrayNames.length; i++) {
                    array = commons_getArray(operation.arrayNames[i])
                    if (framesToWrite > toFloat(array.length) - operation.skip) {
                        sound.push(createFloatArray(toInt(framesToWrite)))
                        sound[i].set(array.subarray(
                            toInt(operation.skip), 
                            toInt(operation.skip + framesToWrite)
                        ))
                    } else {
                        sound.push(array.subarray(
                            toInt(operation.skip), 
                            toInt(operation.skip + framesToWrite)
                        ))
                    }
                }

                ${Func('callback', [
                    Var('fs_OperationId', 'id'),
                    Var('fs_OperationStatus', 'status'),
                ], 'void')`
                    ${ConstVar('SoundfilerOperation', 'operation', `${state.operations}.get(id)`)}
                    ${state.operations}.delete(id)
                    ${snds.$1}(${state.buildMessage1}(operation.soundInfo))
                    ${snds.$0}(msg_floats([operation.framesToWrite]))
                `}

                ${ConstVar('fs_OperationId', 'id', `fs_writeSoundFile(
                    sound, 
                    operation.url, 
                    soundInfo, 
                    callback
                )`)}

                ${state.operations}.set(id, operation)
            }

            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    stateVariables,
    dependencies: [
        sharedCode,
        parseSoundFileOpenOpts,
        stdlib.commonsArrays,
        stdlib.fsReadSoundFile,
        stdlib.fsWriteSoundFile,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}