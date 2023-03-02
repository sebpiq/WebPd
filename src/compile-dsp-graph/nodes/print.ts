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

interface NodeArguments {
    prefix: string
}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => {
        let prefix = 'print:'
        if (pdNode.args.length === 1 && pdNode.args[0] === '-n') {
            prefix = ''
        } else if (pdNode.args.length >= 1) {
            prefix = pdNode.args.join(' ') + ':'
        }
        return { prefix }
    },
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {},
    }),
}

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ globs, node: { args } }) => ({
    '0': `
        console.log("${args.prefix} " + msg_display(${globs.m}))
        return
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { messages, stateVariables }

export { builder, nodeImplementation, NodeArguments }
