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
import { functional, stdlib } from '@webpd/compiler'

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
const sharedCode: GlobalCodeGenerator = ({ macros: { Var }}) => functional.renderCode`
    class SoundfilerOperation {
        ${Var('url', 'string')}
        ${Var('arrayNames', 'Array<string>')}
        ${Var('resize', 'boolean')}
        ${Var('maxSize', 'Float')}
        ${Var('framesToWrite', 'Float')}
        ${Var('skip', 'Float')}
        ${Var('soundInfo', 'fs_SoundInfo')}
    }
`

const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ state, macros: { Func, Var } }) => `
    const ${Var(state.operations, 'Map<fs_OperationId, SoundfilerOperation>')} = new Map()

    const ${state.buildMessage1} = ${Func([
        Var('soundInfo', 'fs_SoundInfo')
    ], 'Message')} => {
        const ${Var('m', 'Message')} = msg_create([
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_STRING_TOKEN,
            soundInfo.endianness.length,
        ])
        msg_writeFloatToken(m, 0, toFloat(soundInfo.sampleRate))
        msg_writeFloatToken(m, 1, -1) // TODO IMPLEMENT headersize
        msg_writeFloatToken(m, 2, toFloat(soundInfo.channelCount))
        msg_writeFloatToken(m, 3, Math.round(toFloat(soundInfo.bitDepth) / 8))
        msg_writeStringToken(m, 4, soundInfo.endianness)
        return m
    }
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs, snds, macros: { Func, Var } }) => ({
    '0': `
    if (
        msg_getLength(${globs.m}) >= 3 
        && msg_isStringToken(${globs.m}, 0)
        && (
            msg_readStringToken(${globs.m}, 0) === 'read'
            || msg_readStringToken(${globs.m}, 0) === 'write'
        )
    ) {
        const ${Var('operationType', 'string')} = msg_readStringToken(${globs.m}, 0)
        const ${Var('soundInfo', 'fs_SoundInfo')} = {
            channelCount: 0,
            sampleRate: toInt(${globs.sampleRate}),
            bitDepth: 32,
            encodingFormat: '',
            endianness: '',
            extraOptions: '',
        }
        const ${Var('operation', 'SoundfilerOperation')} = {
            arrayNames: [],
            resize: false,
            maxSize: -1,
            skip: 0,
            framesToWrite: 0,
            url: '',
            soundInfo,
        }
        let ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
            ${globs.m},
            soundInfo,
        )
        
        // Remove the operation type
        unhandledOptions.delete(0)
        
        let ${Var('i', 'Int')} = 1
        let ${Var('str', 'string')} = ''
        while (i < msg_getLength(${globs.m})) {
            if (!unhandledOptions.has(i)) {

            } else if (msg_isStringToken(${globs.m}, i)) {
                str = msg_readStringToken(${globs.m}, i)
                if (str === '-resize') {
                    unhandledOptions.delete(i)
                    operation.resize = true

                } else if (str === '-maxsize' || str === '-nframes') {
                    unhandledOptions.delete(i)
                    if (
                        i + 1 >= msg_getLength(${globs.m}) 
                        || !msg_isFloatToken(${globs.m}, i + 1)
                    ) {
                        console.log("invalid value for -maxsize")
                    }
                    operation.maxSize = msg_readFloatToken(${globs.m}, i + 1)
                    unhandledOptions.delete(i + 1)
                    i++

                } else if (str === '-skip') {
                    unhandledOptions.delete(i)
                    if (
                        i + 1 >= msg_getLength(${globs.m}) 
                        || !msg_isFloatToken(${globs.m}, i + 1)
                    ) {
                        console.log("invalid value for -skip")
                    }
                    operation.skip = msg_readFloatToken(${globs.m}, i + 1)
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
        let ${Var('urlFound', 'boolean')} = false
        while (i < msg_getLength(${globs.m})) {
            if (!unhandledOptions.has(i)) {

            } else if (msg_isStringToken(${globs.m}, i)) {
                str = msg_readStringToken(${globs.m}, i)
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
            const callback = ${Func([
                Var('id', 'fs_OperationId'),
                Var('status', 'fs_OperationStatus'),
                Var('sound', 'FloatArray[]'),
            ], 'void')} => {
                const ${Var('operation', 'SoundfilerOperation')} = ${state.operations}.get(id)
                ${state.operations}.delete(id)
                let ${Var('i', 'Int')} = 0
                let ${Var('maxFramesRead', 'Float')} = 0
                let ${Var('framesToRead', 'Float')} = 0
                let ${Var('array', 'FloatArray')} = createFloatArray(0)
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
            }

            const ${Var('id', 'fs_OperationId')} = fs_readSoundFile(
                operation.url, 
                soundInfo,
                callback
            )

            ${state.operations}.set(id, operation)

        } else if (operationType === 'write') {
            let ${Var('i', 'Int')} = 0
            let ${Var('framesToWrite', 'Float')} = 0
            let ${Var('array', 'FloatArray')} = createFloatArray(0)
            const ${Var('sound', 'FloatArray[]')} = []
            
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

            const callback = ${Func([
                Var('id', 'fs_OperationId'),
                Var('status', 'fs_OperationStatus'),
            ], 'void')} => {
                const ${Var('operation', 'SoundfilerOperation')} = ${state.operations}.get(id)
                ${state.operations}.delete(id)
                ${snds.$1}(${state.buildMessage1}(operation.soundInfo))
                ${snds.$0}(msg_floats([operation.framesToWrite]))
            }

            const ${Var('id', 'fs_OperationId')} = fs_writeSoundFile(
                sound, 
                operation.url, 
                soundInfo, 
                callback
            )

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