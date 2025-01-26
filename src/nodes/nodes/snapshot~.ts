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
import { bangUtils } from '../global-code/core'
import { AnonFunc, Class, NodeImplementation, Var, ast } from '@webpd/compiler'

interface NodeArguments {}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPullingSignal: true,
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'snapshot_t',
    },

    state: ({ ns }) => 
        Class(ns.State, [
            Var(`Float`, `currentValue`, 0)
        ]),

    dsp: ({ ins, state }) => ast`
        ${state}.currentValue = ${ins.$0}
    `,

    messageReceivers: ({ state, snds }, { msg, bangUtils }) => ({
        '0_message': AnonFunc([ Var(msg.Message, `m`) ], `void`)`
            if (${bangUtils.isBang}(m)) {
                ${snds.$0}(${msg.floats}([${state}.currentValue]))
                return 
            }
        `,
    }),

    dependencies: [ 
        bangUtils,
    ]
}

export { builder, nodeImplementation, NodeArguments }