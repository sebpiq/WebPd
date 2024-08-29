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

import { stdlib, functional, Class, Sequence } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { actionUtils } from '../global-code/core'
import { readWriteFsOpts, soundFileOpenOpts } from '../global-code/fs'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'

const BLOCK_SIZE = 44100 * 5

interface NodeArguments { channelCount: number }

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO: lots of things left to implement
// TODO : check the real state machine of writesf
//      - what happens when start / stopping / start stream ? 
//      - what happens when stream ended and starting again ? 
//      - etc ...

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
    }),
    build: ({ channelCount }) => ({
        inlets: {
            '0_message': { type: 'message', id: '0_message' },
            ...functional.mapArray(functional.countTo(channelCount), (channel) => [
                `${channel}`,
                { type: 'signal', id: `${channel}` },
            ]),
        },
        outlets: {},
        isPullingSignal: true,
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message'}
        }
        return undefined
    },
}

// ------------------------------ node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'write_t',
    },

    state: ({ node: { args }, ns }, { fs }) => 
        Class(ns.State, [
            Var(fs.OperationId, `operationId`, -1),
            Var(`boolean`, `isWriting`, `false`),
            Var(`Array<FloatArray>`, `block`, `[
                ${functional.countTo(args.channelCount).map(() => 
                    `createFloatArray(${BLOCK_SIZE})`
                ).join(',')}
            ]`),
            Var(`Int`, `cursor`, 0),
        ]),

    dsp: ({ ns, state, ins, node: { args } }) => ast`
        if (${state}.isWriting === true) {
            ${functional.countTo(args.channelCount).map((i) => 
                `${state}.block[${i}][${state}.cursor] = ${ins[i]}`)}
            ${state}.cursor++
            if (${state}.cursor === ${BLOCK_SIZE}) {
                ${ns.flushBlock}(${state})
            }
        }
    `, 

    messageReceivers: (
        { ns, node, state }, 
        { core, msg, fs, actionUtils, soundFileOpenOpts, readWriteFsOpts }
    ) => ({
        '0_message': AnonFunc([ 
            Var(msg.Message, `m`) 
        ], 'void')`
            if (${msg.getLength}(m) >= 2) {
                if (
                    ${msg.isStringToken}(m, 0) 
                    && ${msg.readStringToken}(m, 0) === 'open'
                ) {
                    if (${state}.operationId !== -1) {
                        ${fs.closeSoundStream}(${state}.operationId, ${fs.OPERATION_SUCCESS})
                    }
    
                    ${ConstVar(fs.SoundInfo, `soundInfo`, `{
                        channelCount: ${node.args.channelCount},
                        sampleRate: toInt(${core.SAMPLE_RATE}),
                        bitDepth: 32,
                        encodingFormat: '',
                        endianness: '',
                        extraOptions: '',
                    }`)}
                    ${ConstVar(`Set<Int>`, `unhandledOptions`, `${soundFileOpenOpts.parse}(
                        m,
                        soundInfo,
                    )`)}
                    ${ConstVar(`string`, `url`, `${readWriteFsOpts.parse}(
                        m,
                        soundInfo,
                        unhandledOptions
                    )`)}
                    if (url.length === 0) {
                        return
                    }
                    ${state}.operationId = ${fs.openSoundWriteStream}(
                        url,
                        soundInfo,
                        () => {
                            ${ns.flushBlock}(${state})
                            ${state}.operationId = -1
                        }
                    )
                    return
                }
    
            } else if (${actionUtils.isAction}(m, 'start')) {
                    ${state}.isWriting = true
                    return
    
            } else if (${actionUtils.isAction}(m, 'stop')) {
                ${ns.flushBlock}(${state})
                ${state}.isWriting = false
                return
    
            } else if (${actionUtils.isAction}(m, 'print')) {
                console.log('[writesf~] writing = ' + ${state}.isWriting.toString())
                return
            }    
        `
    }), 

    core: ({ ns }, { fs }) => 
        Sequence([
            Func(ns.flushBlock, [
                Var(ns.State, `state`),
            ], 'void')`
                ${ConstVar(`Array<FloatArray>`, `block`, `[]`)}
                for (${Var(`Int`, `i`, `0`)}; i < state.block.length; i++) {
                    block.push(state.block[i].subarray(0, state.cursor))
                }
                ${fs.sendSoundStreamData}(state.operationId, block)
                state.cursor = 0
            `,
        ]),

    dependencies: [
        soundFileOpenOpts,
        readWriteFsOpts,
        actionUtils,
        stdlib.fsWriteSoundStream,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}