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

import { Code } from '@webpd/compiler'
import {
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../nodes-shared-code/core'
import { roundFloatAsPdInt } from '../nodes-shared-code/numbers'
import { coldFloatInletWithSetter } from '../standard-message-receivers'

interface NodeArguments {
    value: number
}
const stateVariables = {
    value: 1,
    funcSetValue: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------- declare ------------------------------ //
const makeDeclare =
    (prepareValueCode: Code = 'value'): _NodeImplementation['declare'] =>
    ({ node: { args }, state, macros: { Var, Func } }) =>
    `
        let ${Var(state.value, 'Float')} = 0

        const ${state.funcSetValue} = ${Func([
            Var('value', 'Float')
        ], 'void')} => { ${state.value} = ${prepareValueCode} }
        
        ${state.funcSetValue}(${args.value})
    `

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    snds,
    globs,
    state,
}) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.funcSetValue}(msg_readFloatToken(${globs.m}, 0))
        ${snds.$0}(msg_floats([${state.value}]))
        return 

    } else if (msg_isBang(${globs.m})) {
        ${snds.$0}(msg_floats([${state.value}]))
        return
        
    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetValue),
})

// ------------------------------------------------------------------- //
const builders = {
    float: builder,
    f: { aliasTo: 'float' },
    int: builder,
    i: { aliasTo: 'int' },
}

const nodeImplementations: NodeImplementations = {
    float: {
        declare: makeDeclare(),
        messages,
        stateVariables,
        sharedCode: [bangUtils],
    },
    int: {
        declare: makeDeclare('roundFloatAsPdInt(value)'),
        messages,
        stateVariables,
        sharedCode: [roundFloatAsPdInt, bangUtils],
    },
}

export { builders, nodeImplementations, NodeArguments }
