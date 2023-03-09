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

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInlet } from '../standard-message-receivers'

interface NodeArguments {
    threshold: number
}
const stateVariables = {
    threshold: 1
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        threshold: assertOptionalNumber(args[0]) || 0
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    node,
    state,
    macros: { Var },
}) => `
    let ${Var(state.threshold, 'Float')} = ${node.args.threshold}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state, macros: { Var } }) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        const ${Var('value', 'Float')} = msg_readFloatToken(${globs.m}, 0)
        if (value >= ${state.threshold}) {
            ${snds[1]}(msg_floats([value]))
        } else {
            ${snds[0]}(msg_floats([value]))
        }
        return
    }
    `,

    '1': coldFloatInlet(globs.m, state.threshold),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { messages, stateVariables, declare }

export { builder, nodeImplementation, NodeArguments }
