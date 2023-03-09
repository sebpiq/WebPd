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

import { functional } from '@webpd/compiler-js'
import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertNumber } from '../validation'

interface NodeArguments { channelCount: number }
const stateVariables = {}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        channelCount: assertNumber(pdNode.args[0]),
    }),
    build: (nodeArgs) => ({
        inlets: functional.mapArray(
            functional.countTo(nodeArgs.channelCount), 
            (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]
        ),
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ node, ins, outs }) => `
    ${outs.$0} = ${Object.keys(node.inlets)
    .map((inletId) => ins[inletId])
    .join(' + ')}
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { loop, stateVariables }

export { builder, nodeImplementation, NodeArguments }