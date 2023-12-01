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
import { nodeCoreTabBase, translateArgsTabBase, variableNamesTabBase } from './tab-base'
import { ConstVar, Func, Sequence, ast, stdlib } from '@webpd/compiler'
import { AnonFunc, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments { arrayName: string }
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('tabread', [
    'setArrayNameFinalize',
])

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Func(variableNames.setArrayNameFinalize, [
        Var(variableNamesTabBase.stateClass, 'state'),
    ], 'void')`
        state.array = commons_getArray(state.arrayName)
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

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = (context) => {
    const { snds, state } = context
    return {
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                if (${state}.array.length === 0) {
                    ${snds.$0}(msg_floats([0]))

                } else {
                    ${snds.$0}(msg_floats([${state}.array[
                        ${variableNamesTabBase.prepareIndex}(
                            msg_readFloatToken(m, 0), 
                            ${state}.array.length
                        )
                    ]]))
                }
                return 

            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    msg_readStringToken(m, 1),
                    () => ${variableNames.setArrayNameFinalize}(${state})
                )
                return
        
            }
        `,
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    initialization: initialization,
    messageReceivers: messageReceivers,
    dependencies: [
        stdlib.commonsWaitEngineConfigure, 
        stdlib.commonsArrays,
        nodeCoreTabBase,
        nodeCore,
    ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}