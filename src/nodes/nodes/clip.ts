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
    minValue: number
    maxValue: number
}
const stateVariables = {
    minValue: 1,
    maxValue: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        minValue: assertOptionalNumber(args[0]) || 0,
        maxValue: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    node,
    state,
    macros: { Var },
}) => `
    let ${Var(state.minValue, 'Float')} = ${node.args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${node.args.maxValue}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state }) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${snds[0]}(msg_floats([
            Math.max(Math.min(${state.maxValue}, msg_readFloatToken(${globs.m}, 0)), ${state.minValue})
        ]))
        return
    }
    `,

    '1': coldFloatInlet(globs.m, state.minValue),
    '2': coldFloatInlet(globs.m, state.maxValue),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages,
    stateVariables,
    declare,
}

export { builder, nodeImplementation, NodeArguments }
