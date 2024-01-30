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

import { Class, Sequence } from '@webpd/compiler'
import {
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { roundFloatAsPdInt } from '../global-code/numbers'

interface NodeArguments {
    value: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        value: assertOptionalNumber(pdNode.args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true,
    }),
}

// ------------------------------- node implementation - shared ------------------------------ //
const sharedNodeImplementation = (
    variableNames: ReturnType<typeof generateVariableNamesNodeType>
): _NodeImplementation => ({

    state: ({ stateClassName }) => 
        Class(stateClassName, [
            Var('Float', 'value', 0),
        ]),

    initialization: ({ node: { args }, state }) => 
        ast`
            ${variableNames.setValue}(${state}, ${args.value})
        `,
    
    messageReceivers: ({
        snds,
        state,
    }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${variableNames.setValue}(${state}, msg_readFloatToken(m, 0))
                ${snds.$0}(msg_floats([${state}.value]))
                return 

            } else if (msg_isBang(m)) {
                ${snds.$0}(msg_floats([${state}.value]))
                return
                
            }
        `,

        '1': coldFloatInletWithSetter(variableNames.setValue, state),
    }),
})

// ------------------------------- node implementation - float ------------------------------ //
const variableNamesFloat = generateVariableNamesNodeType('float', [
    'setValue',
])

const nodeImplementationFloat: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesFloat),

    core: ({ stateClassName }) => 
        Sequence([
            Func(variableNamesFloat.setValue, [
                Var(stateClassName, 'state'),
                Var('Float', 'value'),
            ], 'void')`
                state.value = value
            `
        ]),

    dependencies: [
        bangUtils,
    ],
}

// ------------------------------- node implementation - int ------------------------------ //
const variableNamesInt = generateVariableNamesNodeType('int', [
    'setValue',
])

const nodeImplementationInt: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesInt),

    core: ({ stateClassName }) => 
        Sequence([
            Func(variableNamesInt.setValue, [
                Var(stateClassName, 'state'),
                Var('Float', 'value'),
            ], 'void')`
                state.value = roundFloatAsPdInt(value)
            `,
        ]),

    dependencies: [
        roundFloatAsPdInt,
        bangUtils,
    ],
}

// ------------------------------------------------------------------- //
const builders = {
    float: builder,
    f: { aliasTo: 'float' },
    int: builder,
    i: { aliasTo: 'int' },
}

const nodeImplementations: NodeImplementations = {
    float: nodeImplementationFloat,
    int: nodeImplementationInt,
}

export { builders, nodeImplementations, NodeArguments }
