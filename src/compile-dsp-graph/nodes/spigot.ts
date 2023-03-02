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
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'

interface NodeArguments {
    isClosed: boolean
}
const stateVariables = {
    isClosed: 1,
    funcSetIsClosed: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        isClosed: (assertOptionalNumber(args[0]) || 0) === 0
    }),
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
    node,
    state,
    macros: { Var, Func },
}) => `
    let ${Var(state.isClosed, 'Float')} = ${node.args.isClosed ? 'true': 'false'}

    function ${state.funcSetIsClosed} ${Func([
        Var('value', 'Float'),
    ], 'void')} {
        ${state.isClosed} = (value === 0)
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state }) => ({
    '0': `
    if (!${state.isClosed}) {
        ${snds.$0}(${globs.m})
    }
    return
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetIsClosed),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages,
    stateVariables,
    declare,
}

export { builder, nodeImplementation, NodeArguments }
