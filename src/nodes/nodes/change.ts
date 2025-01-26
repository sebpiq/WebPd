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

import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../global-code/core'
import { AnonFunc, Var, ConstVar, Class, NodeImplementation } from '@webpd/compiler'

interface NodeArguments {
    initValue: number
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Float`, `currentValue`, args.initValue)
        ]),

    messageReceivers: (
        { snds, state }, 
        { bangUtils, msg }
    ) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {
                ${ConstVar(`Float`, `newValue`, `${msg.readFloatToken}(m, 0)`)}
                if (newValue !== ${state}.currentValue) {
                    ${state}.currentValue = newValue
                    ${snds[0]}(${msg.floats}([${state}.currentValue]))
                }
                return
    
            } else if (${bangUtils.isBang}(m)) {
                ${snds[0]}(${msg.floats}([${state}.currentValue]))
                return 
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'set'
            ) {
                ${state}.currentValue = ${msg.readFloatToken}(m, 1)
                return
            }
        `,
    }),

    dependencies: [
        bangUtils
    ],
}

export { builder, nodeImplementation, NodeArguments }
