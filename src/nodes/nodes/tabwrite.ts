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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { nodeCoreTabBase, translateArgsTabBase, variableNamesTabBase, NodeArguments } from './tab-base'
import { ConstVar, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('tabwrite', [
    'setArrayNameFinalize',
    'setWritePosition',
])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: ({ node: { args }}) => 
        Var(variableNamesTabBase.stateClass, '', `${variableNamesTabBase.createState}("${args.arrayName}")`),

    initialization: ({ state }) => ast`
        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames.setArrayNameFinalize}(${state})
                )
            }
        })
    `,

    messageReceivers: (context) => {
        const { state } = context
        return {
            '0': AnonFunc([Var('Message', 'm')])`
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                    if (${state}.array.length === 0) {
                        return
    
                    } else {
                        ${state}.array[${state}.writePosition] = msg_readFloatToken(m, 0)
                        return
                    }
    
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
            
                }
            `,
    
            '1': coldFloatInletWithSetter(variableNames.setWritePosition, state)
        }
    },

    dependencies: [
        stdlib.commonsWaitEngineConfigure, 
        stdlib.commonsArrays,
        nodeCoreTabBase,
        () => Sequence([
            Func(variableNames.setArrayNameFinalize, [
                Var(variableNamesTabBase.stateClass, 'state'),
            ], 'void')`
                state.array = commons_getArray(state.arrayName)
            `,
        
            Func(variableNames.setWritePosition, [
                Var(variableNamesTabBase.stateClass, 'state'),
                Var('Float', 'writePosition')
            ], 'void')`
                state.writePosition = ${variableNamesTabBase.prepareIndex}(writePosition, state.array.length)
            `
        ]),
    ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}