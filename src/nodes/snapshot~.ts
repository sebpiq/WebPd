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
import { NodeBuilder } from '../types'
import { bangUtils } from '../nodes-shared-code/core'

interface NodeArguments {}
const stateVariables = {
    currentValue: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPullingSignal: true,
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        return undefined
    },
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ state, macros: { Var }}) => `
    let ${Var(state.currentValue, 'Float')} = 0
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, state }) => `
    ${state.currentValue} = ${ins.$0}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs, snds }) => ({
    '0_message': `
        if (msg_isBang(${globs.m})) {
            ${snds.$0}(msg_floats([${state.currentValue}]))
            return 
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
    sharedCode: [ bangUtils ]
}

export { builder, nodeImplementation, NodeArguments }