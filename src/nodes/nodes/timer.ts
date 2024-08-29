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

import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils } from '../global-code/core'
import { computeUnitInSamples } from '../global-code/timing'
import { Class } from '@webpd/compiler'
import { AnonFunc, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    unitAmount: number
    unit: string
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        unitAmount: assertOptionalNumber(pdNode.args[0]) || 1,
        unit: assertOptionalString(pdNode.args[1]) || 'msec',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ ns }) => 
        Class(ns.State, [
            Var(`Float`, `sampleRatio`, 0),
            Var(`Int`, `resetTime`, 0),
        ]),

    initialization: ({ node: { args }, state }, { core }) => 
        ast`
            ${state}.sampleRatio = computeUnitInSamples(${core.SAMPLE_RATE}, ${args.unitAmount}, "${args.unit}")
        `,
    
    messageReceivers: ({ snds, state }, { bangUtils, core, msg }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${state}.resetTime = ${core.FRAME}
                return
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'tempo'
            ) {
                ${state}.sampleRatio = computeUnitInSamples(
                    ${core.SAMPLE_RATE}, 
                    ${msg.readFloatToken}(m, 1), 
                    ${msg.readStringToken}(m, 2)
                )
                return
            }
        `,
    
        '1': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${snds.$0}(${msg.floats}([toFloat(${core.FRAME} - ${state}.resetTime) / ${state}.sampleRatio]))
                return
            }
        `,
    }),

    dependencies: [ 
        computeUnitInSamples, 
        bangUtils, 
    ]
}

export { builder, nodeImplementation, NodeArguments }
