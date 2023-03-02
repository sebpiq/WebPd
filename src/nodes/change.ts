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
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { bangUtils } from '../nodes-shared-code/core'

interface NodeArguments {
    initValue: number
}
const stateVariables = {
    currentValue: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
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
}) => 
    `let ${Var(state.currentValue, 'Float')} = ${node.args.initValue}`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    snds,
    globs,
    state,
    macros: { Var },
}) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        const ${Var('newValue', 'Float')} = msg_readFloatToken(${globs.m}, 0)
        if (newValue !== ${state.currentValue}) {
            ${state.currentValue} = newValue
            ${snds[0]}(msg_floats([${state.currentValue}]))
        }
        return

    } else if (msg_isBang(${globs.m})) {
        ${snds[0]}(msg_floats([${state.currentValue}]))
        return 

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.currentValue} = msg_readFloatToken(${globs.m}, 1)
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
