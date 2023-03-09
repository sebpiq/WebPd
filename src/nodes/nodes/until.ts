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
import { bangUtils } from '../nodes-shared-code/core'

interface NodeArguments {}
const stateVariables = {
    continueIter: 1,
}
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
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    macros: { Var },
}) => `
    let ${Var(state.continueIter, 'boolean')} = true
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state, macros: { Var } }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.continueIter} = true
        while (${state.continueIter}) {
            ${snds[0]}(msg_bang())
        }
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.continueIter} = true
        let ${Var('maxIterCount', 'Int')} = toInt(msg_readFloatToken(${globs.m}, 0))
        let ${Var('iterCount', 'Int')} = 0
        while (${state.continueIter} && iterCount++ < maxIterCount) {
            ${snds[0]}(msg_bang())
        }
        return
    }
    `,

    '1': `
    if (msg_isBang(${globs.m})) {
        ${state.continueIter} = false
        return
    }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages,
    stateVariables,
    declare,
    sharedCode: [bangUtils],
}

export { builder, nodeImplementation, NodeArguments }
