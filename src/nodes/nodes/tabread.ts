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
import { nodeCoreTabBase, translateArgsTabBase, NodeArguments, variableNamesTabBaseNameList } from './tab-base'
import { Class, Func, Sequence, ast, stdlib } from '@webpd/compiler'
import { AnonFunc, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

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

// ------------------------------ node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('tabread', [
    ...variableNamesTabBaseNameList,
    'setArrayNameFinalize',
])

const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, stateClassName }) => 
        Class(stateClassName, [
            Var('FloatArray', 'array', variableNames.emptyArray),
            Var('string', 'arrayName', `"${args.arrayName}"`),
            Var('SkedId', 'arrayChangesSubscription', 'SKED_ID_NULL'),
            Var('Int', 'readPosition', 0),
            Var('Int', 'readUntil', 0),
            Var('Int', 'writePosition', 0),
        ]),
    
    initialization: ({ state }) => ast`
        if (${state}.arrayName.length) {
            ${variableNames.setArrayName}(
                ${state}, 
                ${state}.arrayName,
                () => ${variableNames.setArrayNameFinalize}(${state})
            )
        }
    `,

    messageReceivers: (context) => {
        const { snds, state } = context
        return {
            '0': AnonFunc([Var('Message', 'm')])`
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                    if (${state}.array.length === 0) {
                        ${snds.$0}(msg_floats([0]))

                    } else {
                        ${snds.$0}(msg_floats([${state}.array[
                            ${variableNames.prepareIndex}(
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
                    ${variableNames.setArrayName}(
                        ${state}, 
                        msg_readStringToken(m, 1),
                        () => ${variableNames.setArrayNameFinalize}(${state})
                    )
                    return
            
                }
            `,
        }
    },

    core: ({ stateClassName }) => 
        Sequence([
            nodeCoreTabBase(variableNames, stateClassName),

            Func(variableNames.setArrayNameFinalize, [
                Var(stateClassName, 'state'),
            ], 'void')`
                state.array = commons_getArray(state.arrayName)
            `,
        ]),

    dependencies: [
        stdlib.commonsArrays,
    ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}