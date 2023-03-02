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

interface NodeArguments {}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : implement seed
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => {
        return {
            inlets: {
                '0': { type: 'message', id: '0' },
            },
            outlets: {
                '0': { type: 'signal', id: '0' },
            },
        }
    },
}

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ outs }) => `
    ${outs.$0} = Math.random() * 2 - 1
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ globs }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'seed'
    ) {
        console.log('WARNING : seed not implemented yet for [noise~]')
        return
    }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { loop, messages, stateVariables }

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}