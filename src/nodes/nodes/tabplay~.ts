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

import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler/src/ast/declare'

interface NodeArguments { arrayName: string }
const stateVariables = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    readPosition: 1,
    readUntil: 1,
    funcSetArrayName: 1,
    funcStop: 1,
    funcPlay: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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
const generateDeclarations: _NodeImplementation['generateDeclarations'] = (
    { state, node },
) => ast`
    ${Var('FloatArray', state.array, 'createFloatArray(0)')}
    ${Var('string', state.arrayName, `"${node.args.arrayName}"`)}
    ${Var('SkedId', state.arrayChangesSubscription, 'SKED_ID_NULL')}
    ${Var('Int', state.readPosition, '0')}
    ${Var('Int', state.readUntil, '0')}

    ${Func(state.funcSetArrayName, [
        Var('string', 'arrayName')
    ], 'void')`
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        ${state.funcStop}()
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
            ${state.readPosition} = ${state.array}.length
            ${state.readUntil} = ${state.array}.length
        })
    `}

    ${Func(state.funcPlay, [
        Var('Int', 'playFrom'),
        Var('Int', 'playTo'),
    ], 'void')`
        ${state.readPosition} = playFrom
        ${state.readUntil} = toInt(Math.min(
            toFloat(playTo), 
            toFloat(${state.array}.length),
        ))
    `}

    ${Func(state.funcStop, [], 'void')`
        ${state.readPosition} = 0
        ${state.readUntil} = 0
    `}

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`

// ------------------------------- generateLoop ------------------------------ //
const generateLoop: _NodeImplementation['generateLoop'] = (
    {state, snds, outs},
) => ast`
    if (${state.readPosition} < ${state.readUntil}) {
        ${outs.$0} = ${state.array}[${state.readPosition}]
        ${state.readPosition}++
        if (${state.readPosition} >= ${state.readUntil}) {
            ${snds.$1}(msg_bang())
        }
    } else {
        ${outs.$0} = 0
    }
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_isBang(m)) {
            ${state.funcPlay}(0, ${state.array}.length)
            return 
            
        } else if (msg_isAction(m, 'stop')) {
            ${state.funcStop}()
            return 

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'set'
        ) {
            ${state.funcSetArrayName}(msg_readStringToken(m, 1))   
            return

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${state.funcPlay}(
                toInt(msg_readFloatToken(m, 0)), 
                ${state.array}.length
            )
            return 

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
            ${ConstVar('Int', 'fromSample', `toInt(msg_readFloatToken(m, 0))`)}
            ${state.funcPlay}(
                fromSample,
                fromSample + toInt(msg_readFloatToken(m, 1)),
            )
            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    generateLoop,
    stateVariables,
    dependencies: [
        bangUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsArrays,
        stringMsgUtils,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}