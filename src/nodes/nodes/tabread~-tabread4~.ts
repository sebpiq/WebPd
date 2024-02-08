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
import { Class, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { nodeCoreTabBase, NodeArguments, variableNamesTabBaseNameList } from './tab-base'

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
    ...variableNamesTabBaseNameList,
    'setArrayNameFinalize',
])

const nodeImplementation: _NodeImplementation = {
    flags: {
        isDspInline: true,
        alphaName: 'tabread_t',
    },

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

    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNames.setArrayName}(
                    ${state},
                    msg_readStringToken(m, 1),
                    () => ${variableNames.setArrayNameFinalize}(${state}),
                )
                return
    
            }
        `,
    }),

    dsp: ({ ins, state }) => 
        ast`${state}.array[toInt(Math.max(Math.min(Math.floor(${ins.$0}), ${state}.array.length - 1), 0))]`,
    
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
        bangUtils,
        stdlib.commonsArrays,
        stringMsgUtils,
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