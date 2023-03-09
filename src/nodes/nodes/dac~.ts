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

interface NodeArguments {
    channelMapping: Array<number>
}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : set message not supported
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode, patch) => {
        let channelMapping: Array<number>
        if (pdNode.args.length) {
            // Channels are provided as 1-indexed, so we translate them back to 0-indexed.
            channelMapping = pdNode.args.map(
                (channel) => assertNumber(channel) - 1
            )
        } else {
            // If no channel is provided, since a patch doesn't contain the channel count info,
            // we just guess the `channelMapping` according to inlets that are defined on the dac.
            const dacInletIds = new Set<number>()
            patch.connections.forEach((connection) => {
                if (connection.sink.nodeId === pdNode.id) {
                    dacInletIds.add(connection.sink.portletId)
                }
            })
            const maxInlet = Math.max(...dacInletIds)
            channelMapping = []
            for (let channel = 0; channel <= maxInlet; channel++) {
                channelMapping.push(channel)
            }
        }
        return { channelMapping }
    },
    build: (nodeArgs) => ({
        inlets: functional.mapArray(
            nodeArgs.channelMapping, 
            (_, i) => [`${i}`, { type: 'signal', id: `${i}` }]
        ),
        outlets: {},
        isPullingSignal: true,
    }),
}

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({
    ins,
    globs,
    node,
    compilation: { audioSettings, target },
}) =>
    node.args.channelMapping
        // Save the original index
        .map((destination, i) => [destination, i])
        // Ignore channels that are out of bounds
        .filter(
            ([destination]) =>
                0 <= destination && destination < audioSettings.channelCount.out
        )
        .map(([destination, i]) =>
            target === 'javascript'
                ? `${globs.output}[${destination}][${globs.iterFrame}] = ${ins[`${i}`]}`
                : `${globs.output}[${globs.iterFrame} + ${globs.blockSize} * ${destination}] = ${ins[`${i}`]}`
        )
        .join('\n') + '\n'

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { loop, stateVariables }

export { builder, nodeImplementation, NodeArguments }
