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
import { assertOptionalString } from '../validation'
import { bangUtils } from '../global-code/core'
import { msgBuses } from '../global-code/buses'
import { AnonFunc, Class, NodeImplementation, Var } from '@webpd/compiler'

interface NodeArguments {
    value: string
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        value: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true,
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`string`, `value`, `"${args.value}"`)
        ]),

    messageReceivers: ({ snds, state }, { msg, bangUtils }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${snds.$0}(${msg.strings}([${state}.value]))
                return
    
            } else if (${msg.isMatching}(m, [${msg.STRING_TOKEN}])) {
                ${state}.value = ${msg.readStringToken}(m, 0)
                ${snds.$0}(${msg.strings}([${state}.value]))
                return
    
            }
        `,
    
        '1': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.isMatching}(m, [${msg.STRING_TOKEN}])) {
                ${state}.value = ${msg.readStringToken}(m, 0)
                return 
            }
        `,
    }),

    dependencies: [
        bangUtils, 
        msgBuses,
    ]
}

export { builder, nodeImplementation, NodeArguments }