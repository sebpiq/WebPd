/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */
import {
    Code,
    NodeImplementation,
    NodeImplementations,
    SharedCodeGenerator,
} from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { ftom, mtof } from '../nodes-shared-code/funcs'

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
    sharedCode = [],
}: {
    operationCode: Code,
    sharedCode?: Array<SharedCodeGenerator>
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

    return { messages, stateVariables, sharedCode }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs': makeNodeImplementation({ operationCode: `Math.abs(value)` }),
    'wrap': makeNodeImplementation({ operationCode: `(1 + (value % 1)) % 1` }),
    'cos': makeNodeImplementation({ operationCode: `Math.cos(value)` }),
    'sqrt': makeNodeImplementation({ operationCode: `value >= 0 ? Math.pow(value, 0.5): 0` }),
    'mtof': makeNodeImplementation({ operationCode: `mtof(value)`, sharedCode: [mtof] }),
    'ftom': makeNodeImplementation({ operationCode: `ftom(value)`, sharedCode: [ftom] }),
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
