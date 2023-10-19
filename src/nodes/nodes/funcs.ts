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
import {
    Code,
    NodeImplementation,
    NodeImplementations,
    GlobalCodeGenerator,
} from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { ftom, mtof } from '../global-code/funcs'

interface NodeArguments {}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

const makeNodeImplementation = ({
    operationCode,
    globalCode = [],
}: {
    operationCode: Code,
    globalCode?: Array<GlobalCodeGenerator>
}): _NodeImplementation => {

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({ globs, snds, macros: { Var } }) => ({
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            const ${Var('value', 'Float')} = msg_readFloatToken(${globs.m}, 0)
            ${snds.$0}(msg_floats([${operationCode}]))
            return
        }
        `
    })

    return { messages, stateVariables, globalCode }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs': makeNodeImplementation({ operationCode: `Math.abs(value)` }),
    'wrap': makeNodeImplementation({ operationCode: `(1 + (value % 1)) % 1` }),
    'cos': makeNodeImplementation({ operationCode: `Math.cos(value)` }),
    'sqrt': makeNodeImplementation({ operationCode: `value >= 0 ? Math.pow(value, 0.5): 0` }),
    'mtof': makeNodeImplementation({ operationCode: `mtof(value)`, globalCode: [mtof] }),
    'ftom': makeNodeImplementation({ operationCode: `ftom(value)`, globalCode: [ftom] }),
    'rmstodb': makeNodeImplementation({ operationCode: `value <= 0 ? 0 : 20 * Math.log(value) / Math.LN10 + 100` }),
    'dbtorms': makeNodeImplementation({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 20)` }),
    'powtodb': makeNodeImplementation({ operationCode: `value <= 0 ? 0 : 10 * Math.log(value) / Math.LN10 + 100` }),
    'dbtopow': makeNodeImplementation({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 10)` }),
    // Implement vu as a noop
    'vu': makeNodeImplementation({ operationCode: `value` }),
}

const builders = {
    'abs': builder,
    'cos': builder,
    'wrap': builder,
    'sqrt': builder,
    'mtof': builder,
    'ftom': builder,
    'rmstodb': builder,
    'dbtorms': builder,
    'powtodb': builder,
    'dbtopow': builder,
    'vu': builder,
}

export { builders, nodeImplementations, NodeArguments }
