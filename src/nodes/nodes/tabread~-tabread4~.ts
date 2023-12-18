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
import { Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { nodeCoreTabBase, variableNamesTabBase, NodeArguments } from './tab-base'

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : tabread4 interpolation algorithm
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------ node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('tabread_t', [
    'setArrayNameFinalize',
])

const nodeImplementation: _NodeImplementation = {
    initialization: ({ node: { args }, state }) => ast`
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
    `,

    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc([Var('Message', 'm')])`
            if (
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
    }),

    inlineLoop: ({ ins, state }) => 
        ast`${state}.array[toInt(Math.max(Math.min(Math.floor(${ins.$0}), ${state}.array.length - 1), 0))]`,
    
    dependencies: [
        bangUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsArrays,
        stringMsgUtils,
        nodeCoreTabBase,
        () => Sequence([
            Func(variableNames.setArrayNameFinalize, [
                Var(variableNamesTabBase.stateClass, 'state'),
            ], 'void')`
                state.array = commons_getArray(state.arrayName)
            `,
        ]),
    ],
}

const builders = {
    'tabread~': builder,
    'tabread4~': builder,
}

const nodeImplementations = {
    'tabread~': nodeImplementation,
    'tabread4~': nodeImplementation,
}

export { 
    builders,
    nodeImplementations,
    NodeArguments,
}