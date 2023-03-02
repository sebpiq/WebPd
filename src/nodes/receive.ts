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
import { assertOptionalString } from '../nodes-shared-code/validation'
import { messageBuses } from '../nodes-shared-code/buses'

interface NodeArguments {
    busName: string
}
const stateVariables = {}
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
        inlets: {},
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    compilation: { codeVariableNames: { nodes } },
    node: { id, args },
}) => `
    commons_waitEngineConfigure(() => {
        msgBusSubscribe("${args.busName}", ${nodes[id].snds.$0})
    })
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    stateVariables,
    declare,
    sharedCode: [messageBuses],
}

export { builder, nodeImplementation, NodeArguments }
