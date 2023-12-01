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
import { assertOptionalString } from '../validation'
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { nodeCoreTabBase, variableNamesTabBase } from './tab-base'

interface NodeArguments { arrayName: string }

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : Should work also if array was set the play started
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('tabplay_t', [
    'setArrayNameFinalize',
    'play',
    'stop',
])

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Func(variableNames.setArrayNameFinalize, [
        Var(variableNamesTabBase.stateClass, 'state'),
    ], 'void')`
        state.array = commons_getArray(state.arrayName)
        state.readPosition = state.array.length
        state.readUntil = state.array.length
    `,

    Func(variableNames.play, [
        Var(variableNamesTabBase.stateClass, 'state'),
        Var('Int', 'playFrom'),
        Var('Int', 'playTo'),
    ], 'void')`
        state.readPosition = playFrom
        state.readUntil = toInt(Math.min(
            toFloat(playTo), 
            toFloat(state.array.length),
        ))
    `,

    Func(variableNames.stop, [
        Var(variableNamesTabBase.stateClass, 'state'),
    ], 'void')`
        state.readPosition = 0
        state.readUntil = 0
    `,
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args }, state }) => 
    ast`
        ${ConstVar(
            variableNamesTabBase.stateClass, 
            state, 
            `${variableNamesTabBase.createState}("${args.arrayName}")`
        )}

        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames.setArrayNameFinalize}(${state})
                )
            }
        })
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = (
    {state, snds, outs},
) => ast`
    if (${state}.readPosition < ${state}.readUntil) {
        ${outs.$0} = ${state}.array[${state}.readPosition]
        ${state}.readPosition++
        if (${state}.readPosition >= ${state}.readUntil) {
            ${snds.$1}(msg_bang())
        }
    } else {
        ${outs.$0} = 0
    }
`

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ state, globs }) => ({
    '0': AnonFunc([Var('Message', 'm')])`
        if (msg_isBang(m)) {
            ${variableNames.play}(${state}, 0, ${state}.array.length)
            return 
            
        } else if (msg_isAction(m, 'stop')) {
            ${variableNames.stop}(${state})
            return 

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'set'
        ) {
            ${variableNamesTabBase.setArrayName}(
                ${state},
                msg_readStringToken(m, 1),
                () => ${variableNames.setArrayNameFinalize}(${state}),
            )
            return

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${variableNames.play}(
                ${state},
                toInt(msg_readFloatToken(m, 0)), 
                ${state}.array.length
            )
            return 

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
            ${ConstVar('Int', 'fromSample', `toInt(msg_readFloatToken(m, 0))`)}
            ${variableNames.play}(
                ${state},
                fromSample,
                fromSample + toInt(msg_readFloatToken(m, 1)),
            )
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
        bangUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsArrays,
        stringMsgUtils,
        nodeCoreTabBase,
        nodeCore,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}