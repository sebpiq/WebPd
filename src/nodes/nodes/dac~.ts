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

import { functional, NodeImplementation, Sequence } from '@webpd/compiler'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertNumber } from '../validation'

interface NodeArguments {
    channelMapping: Array<number>
}
type _NodeImplementation = NodeImplementation<NodeArguments>

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

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'dac_t',
    },

    dsp: ({ ins, node }, { core }, { audio, target }) => Sequence([
        node.args.channelMapping
            // Save the original index
            .map((destination, i) => [destination, i])
            // Ignore channels that are out of bounds
            .filter(
                ([destination]) =>
                    0 <= destination && destination < audio.channelCount.out
            )
            .map(([destination, i]) =>
                target === 'javascript'
                    ? `${core.OUTPUT}[${destination}][${core.IT_FRAME}] = ${ins[`${i}`]}`
                    : `${core.OUTPUT}[${core.IT_FRAME} + ${core.BLOCK_SIZE} * ${destination}] = ${ins[`${i}`]}`
            )
    ])
}

export { builder, nodeImplementation, NodeArguments }
