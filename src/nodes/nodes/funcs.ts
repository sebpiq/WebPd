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
    NodeImplementation,
    NodeImplementations,
    GlobalCodeGenerator,
} from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { ftom, mtof } from '../global-code/funcs'
import { Code } from '@webpd/compiler'
import { AnonFunc, Var, ConstVar } from '@webpd/compiler'

interface NodeArguments {}
type _NodeImplementation = NodeImplementation<NodeArguments>

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
    dependencies = [],
}: {
    operationCode: Code,
    dependencies?: Array<GlobalCodeGenerator>
}): _NodeImplementation => {

    // ------------------------------- node implementation ------------------------------ //
    return { 
        messageReceivers: ({ snds }) => ({
            '0': AnonFunc([Var('Message', 'm')])`
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${ConstVar('Float', 'value', 'msg_readFloatToken(m, 0)')}
                    ${snds.$0}(msg_floats([${operationCode}]))
                    return
                }
            `
        }), 
        dependencies
    }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs': makeNodeImplementation({ operationCode: `Math.abs(value)` }),
    'wrap': makeNodeImplementation({ operationCode: `(1 + (value % 1)) % 1` }),
    'cos': makeNodeImplementation({ operationCode: `Math.cos(value)` }),
    'sqrt': makeNodeImplementation({ operationCode: `value >= 0 ? Math.pow(value, 0.5): 0` }),
    'mtof': makeNodeImplementation({ operationCode: `mtof(value)`, dependencies: [mtof] }),
    'ftom': makeNodeImplementation({ operationCode: `ftom(value)`, dependencies: [ftom] }),
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
