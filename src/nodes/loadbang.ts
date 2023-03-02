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
const stateVariables = {}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: { '0': { type: 'message', id: '0' } },
        isPushingMessages: true
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ snds }) => 
    `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    declare, 
    stateVariables,
    sharedCode: [ bangUtils ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}