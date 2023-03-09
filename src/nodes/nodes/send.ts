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
import { assertOptionalString } from '../validation'
import { messageBuses } from '../nodes-shared-code/buses'
import { coldStringInlet } from '../standard-message-receivers'

interface NodeArguments {
    busName: string
}
const stateVariables = {
    busName: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    macros: { Var },
    node: { args },
}) => `
    let ${Var(state.busName, 'string')} = "${args.busName}"
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    state,
    globs,
}) => ({
    '0': `
    msgBusPublish(${state.busName}, ${globs.m})
    return
    `,

    '1': coldStringInlet(globs.m, state.busName)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    stateVariables,
    declare,
    messages,
    sharedCode: [messageBuses],
}

export { builder, nodeImplementation, NodeArguments }
