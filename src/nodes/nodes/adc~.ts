/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
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
            const adcOutletIds = new Set<number>()
            patch.connections.forEach((connection) => {
                if (connection.source.nodeId === pdNode.id) {
                    adcOutletIds.add(connection.source.portletId)
                }
            })
            const maxOutlet = Math.max(...adcOutletIds)
            channelMapping = []
            for (let channel = 0; channel <= maxOutlet; channel++) {
                channelMapping.push(channel)
            }
        }
        return { channelMapping }
    },
    build: (nodeArgs) => ({
        inlets: {},
        outlets: functional.mapArray(
            nodeArgs.channelMapping, 
            (_, i) => [`${i}`, { type: 'signal', id: `${i}` }]
        ),
    }),
}

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({
    outs,
    globs,
    node,
    compilation: { audioSettings, target },
}) => node.args.channelMapping
    // Save the original index 
    .map((source, i) => [source, i])
    // Ignore channels that are out of bounds
    .filter(
        ([source]) => 0 <= source && source < audioSettings.channelCount.in
    )
    .map(([source, i]) =>
        target === 'javascript'
            ? `${outs[`${i}`]} = ${globs.input}[${source}][${globs.iterFrame}]`
            : `${outs[`${i}`]} = ${globs.input}[${globs.iterFrame} + ${globs.blockSize} * ${source}]`
    )
    .join('\n') + '\n'

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { loop, stateVariables }

export { builder, nodeImplementation, NodeArguments }
