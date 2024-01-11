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
import { stringMsgUtils } from '../global-code/core'
import { parseReadWriteFsOpts, parseSoundFileOpenOpts } from '../global-code/fs'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

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
const variableNames = generateVariableNamesNodeType('writesf_t', [
    'flushBlock'
])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: ({ node: { args } }) => 
        Var(variableNames.stateClass, '', `{
            operationId: -1,
            isWriting: false,
            cursor: 0,
            block: [
                ${functional.countTo(args.channelCount).map(() => 
                    `createFloatArray(${BLOCK_SIZE})`
                ).join(',')}
            ],
        }`),

    loop: ({ state, ins, node: { args } }) => ast`
        if (${state}.isWriting === true) {
            ${functional.countTo(args.channelCount).map((i) => 
                `${state}.block[${i}][${state}.cursor] = ${ins[i]}`)}
            ${state}.cursor++
            if (${state}.cursor === ${BLOCK_SIZE}) {
                ${variableNames.flushBlock}(${state})
            }
        }
    `, 

    messageReceivers: ({ node, state, globs }) => ({
        '0_message': AnonFunc([ Var('Message', 'm') ], 'void')`
            if (msg_getLength(m) >= 2) {
                if (
                    msg_isStringToken(m, 0) 
                    && msg_readStringToken(m, 0) === 'open'
                ) {
                    if (${state}.operationId !== -1) {
                        fs_closeSoundStream(${state}.operationId, FS_OPERATION_SUCCESS)
                    }
    
                    ${ConstVar('fs_SoundInfo', 'soundInfo', `{
                        channelCount: ${node.args.channelCount},
                        sampleRate: toInt(${globs.sampleRate}),
                        bitDepth: 32,
                        encodingFormat: '',
                        endianness: '',
                        extraOptions: '',
                    }`)}
                    ${ConstVar('Set<Int>', 'unhandledOptions', `parseSoundFileOpenOpts(
                        m,
                        soundInfo,
                    )`)}
                    ${ConstVar('string', 'url', `parseReadWriteFsOpts(
                        m,
                        soundInfo,
                        unhandledOptions
                    )`)}
                    if (url.length === 0) {
                        return
                    }
                    ${state}.operationId = fs_openSoundWriteStream(
                        url,
                        soundInfo,
                        () => {
                            ${variableNames.flushBlock}(${state})
                            ${state}.operationId = -1
                        }
                    )
                    return
                }
    
            } else if (msg_isAction(m, 'start')) {
                    ${state}.isWriting = true
                    return
    
            } else if (msg_isAction(m, 'stop')) {
                ${variableNames.flushBlock}(${state})
                ${state}.isWriting = false
                return
    
            } else if (msg_isAction(m, 'print')) {
                console.log('[writesf~] writing = ' + ${state}.isWriting.toString())
                return
            }    
        `
    }), 

    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        stringMsgUtils,
        stdlib.fsWriteSoundStream,
        () => Sequence([
            Class(variableNames.stateClass, [
                Var('fs_OperationId', 'operationId'),
                Var('boolean', 'isWriting'),
                Var('Array<FloatArray>', 'block'),
                Var('Int', 'cursor'),
            ]),
        
            Func(variableNames.flushBlock, [
                Var(variableNames.stateClass, 'state'),
            ], 'void')`
                ${ConstVar('Array<FloatArray>', 'block', '[]')}
                for (${Var('Int', 'i', '0')}; i < state.block.length; i++) {
                    block.push(state.block[i].subarray(0, state.cursor))
                }
                fs_sendSoundStreamData(state.operationId, block)
                state.cursor = 0
            `,
        ]),
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}