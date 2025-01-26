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
import { coldFloatInlet } from '../standard-message-receivers'
import { AnonFunc, Class, ConstVar, NodeImplementation, Var } from '@webpd/compiler'

interface NodeArguments {
    threshold: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        threshold: assertOptionalNumber(args[0]) || 0
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Float`, `threshold`, args.threshold),
        ]),

    messageReceivers: ({ snds, state }, { msg }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {
                ${ConstVar(`Float`, `value`, `${msg.readFloatToken}(m, 0)`)}
                if (value >= ${state}.threshold) {
                    ${snds[1]}(${msg.floats}([value]))
                } else {
                    ${snds[0]}(${msg.floats}([value]))
                }
                return
            }
        `,
    
        '1': coldFloatInlet(`${state}.threshold`, msg),
    }),
}

export { builder, nodeImplementation, NodeArguments }
