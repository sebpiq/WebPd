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

import { functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
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

// ------------------------------- generateLoop ------------------------------ //
const generateLoop: _NodeImplementation['generateLoop'] = ({ node, ins, outs }) => `
    ${outs.$0} = ${Object.keys(node.inlets)
    .map((inletId) => ins[inletId])
    .join(' + ')}
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { generateLoop, stateVariables }

export { builder, nodeImplementation, NodeArguments }