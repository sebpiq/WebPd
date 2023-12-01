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

import { stdlib, functional, Class, Func, Sequence } from '@webpd/compiler'
import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { parseReadWriteFsOpts, parseSoundFileOpenOpts } from '../global-code/fs'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    channelCount: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : check the real state machine of readsf
//      - what happens when start / stopping / start stream ?
//      - what happens when stream ended and starting again ?
//      - etc ...
// TODO : second arg : "buffer channel size" not implemented
// TODO : implement raw

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
    }),
    build: (nodeArgs) => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            ...functional.mapArray(
                functional.countTo(nodeArgs.channelCount),
                (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]
            ),
            [`${nodeArgs.channelCount}`]: {
                type: 'message',
                id: `${nodeArgs.channelCount}`,
            }
        },
    })
}

// ------------------------------ generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('readsf_t', [
    'openStream',
])

const nodeCore: GlobalCodeGenerator = ({ globs }) => Sequence([
    Class(variableNames.stateClass, [
        Var('Array<buf_SoundBuffer>', 'buffers'),
        Var('fs_OperationId', 'streamOperationId'),
        Var('Int', 'readingStatus'),
    ]),

    Func(variableNames.openStream, [
        Var(variableNames.stateClass, 'state'),
        Var('Message', 'm'),
        Var('Int', 'channelCount'),
        Var('fs_OperationCallback', 'onStreamClose'),
    ], 'void')`
        if (state.streamOperationId !== -1) {
            state.readingStatus = 3
            fs_closeSoundStream(state.streamOperationId, FS_OPERATION_SUCCESS)
        }

        ${ConstVar('fs_SoundInfo', 'soundInfo', `{
            channelCount,
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
        state.streamOperationId = fs_openSoundReadStream(
            url,
            soundInfo,
            onStreamClose,
        )
        state.buffers = _FS_SOUND_STREAM_BUFFERS.get(state.streamOperationId)
    `
])

const initialization: _NodeImplementation['initialization'] = ({ state }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            buffers: [],
            streamOperationId: -1,
            readingStatus: 0,
        }`)}
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({
    state,
    snds,
    outs,
    node: {
        args: { channelCount },
    },
}) => ast`
    switch(${state}.readingStatus) {
        case 1: 
            ${functional.countTo(channelCount).map((i) => 
                `${outs[i]} = buf_pullSample(${state}.buffers[${i}])`)}
            break
            
        case 2: 
            ${functional.countTo(channelCount).map((i) => 
                `${outs[i]} = buf_pullSample(${state}.buffers[${i}])`)}
            if (${state}.buffers[0].pullAvailableLength === 0) {
                ${snds[channelCount]}(msg_bang())
                ${state}.readingStatus = 3
            }
            break

        case 3: 
            ${functional.countTo(channelCount).map((i) => `${outs[i]} = 0`)}
            ${state}.readingStatus = 0
            break
    }
`

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({
    node,
    state,
}) => ({
    '0': AnonFunc([Var('Message', 'm')])`
        if (msg_getLength(m) >= 2) {
            if (msg_isStringToken(m, 0) 
                && msg_readStringToken(m, 0) === 'open'
            ) {
                ${variableNames.openStream}(
                    ${state},
                    m,
                    ${node.args.channelCount},
                    ${AnonFunc()`
                        ${state}.streamOperationId = -1
                        if (${state}.readingStatus === 1) {
                            ${state}.readingStatus = 2
                        } else {
                            ${state}.readingStatus = 3
                        }
                    `}
                )
                return
            }

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            if (msg_readFloatToken(m, 0) === 0) {
                ${state}.readingStatus = 3
                return

            } else {
                if (${state}.streamOperationId !== -1) {
                    ${state}.readingStatus = 1
                } else {
                    console.log('[readsf~] start requested without prior open')
                }
                return

            }
            
        } else if (msg_isAction(m, 'print')) {
            console.log('[readsf~] reading = ' + ${state}.readingStatus.toString())
            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    initialization: initialization,
    messageReceivers: messageReceivers,
    loop: loop,
    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        bangUtils,
        stringMsgUtils,
        stdlib.fsReadSoundStream,
        nodeCore,
    ],
}

export { builder, nodeImplementation, NodeArguments }
