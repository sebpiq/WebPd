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

import { functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { stringMsgUtils } from '../nodes-shared-code/core'
import { parseReadWriteFsOpts, parseSoundFileOpenOpts } from '../nodes-shared-code/fs'

const BLOCK_SIZE = 44100 * 5

interface NodeArguments { channelCount: number }
const stateVariables = {
    isWriting: 1,
    operationId: 1,
    block: 1,
    cursor: 1,
    funcFlushBlock: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ state, node: {args}, macros: { Func, Var } }) => functional.renderCode`
    let ${Var(state.operationId, 'fs_OperationId')} = -1
    let ${Var(state.isWriting, 'boolean')} = false
    const ${Var(state.block, 'Array<FloatArray>')} = [
        ${functional.countTo(args.channelCount).map(() => 
            `createFloatArray(${BLOCK_SIZE}),`)}
    ]
    let ${Var(state.cursor, 'Int')} = 0

    const ${state.funcFlushBlock} = ${Func([
    ], 'void')} => {
        const ${Var('block', 'Array<FloatArray>')} = []
        for (let ${Var('i', 'Int')} = 0; i < ${state.block}.length; i++) {
            block.push(${state.block}[i].subarray(0, ${state.cursor}))
        }
        fs_sendSoundStreamData(${state.operationId}, block)
        ${state.cursor} = 0
    }
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ state, ins, node: { args } }) => functional.renderCode`
    if (${state.isWriting} === true) {
        ${functional.countTo(args.channelCount).map((i) => 
            `${state.block}[${i}][${state.cursor}] = ${ins[i]}`)}
        ${state.cursor}++
        if (${state.cursor} === ${BLOCK_SIZE}) {
            ${state.funcFlushBlock}()
        }
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ node, state, globs, macros: { Var } }) => ({
    '0_message': `
    if (msg_getLength(${globs.m}) >= 2) {
        if (
            msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'open'
        ) {
            if (${state.operationId} !== -1) {
                fs_closeSoundStream(${state.operationId}, FS_OPERATION_SUCCESS)
            }

            const ${Var('soundInfo', 'fs_SoundInfo')} = {
                channelCount: ${node.args.channelCount},
                sampleRate: toInt(${globs.sampleRate}),
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }
            const ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
                ${globs.m},
                soundInfo,
            )
            const ${Var('url', 'string')} = parseReadWriteFsOpts(
                ${globs.m},
                soundInfo,
                unhandledOptions
            )
            if (url.length === 0) {
                return
            }
            ${state.operationId} = fs_openSoundWriteStream(
                url,
                soundInfo,
                () => {
                    ${state.funcFlushBlock}()
                    ${state.operationId} = -1
                }
            )
            return
        }

    } else if (msg_isAction(${globs.m}, 'start')) {
            ${state.isWriting} = true
            return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcFlushBlock}()
        ${state.isWriting} = false
        return

    } else if (msg_isAction(${globs.m}, 'print')) {
        console.log('[writesf~] writing = ' + ${state.isWriting}.toString())
        return
    }    
    `
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare, 
    messages, 
    loop, 
    stateVariables,
    sharedCode: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        stringMsgUtils,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}