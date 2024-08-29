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
import { AnonFunc, Class, Var, ast } from '@webpd/compiler'

interface NodeArguments {}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
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
        alphaName: 'samphold_t',
    },

    state: ({ ns }) => 
        Class(ns.State, [
            Var(`Float`, `signalMemory`, 0),
            Var(`Float`, `controlMemory`, 0),
        ]),

    dsp: ({ ins, outs, state }) => ast`
        ${state}.signalMemory = ${outs.$0} = ${ins.$1} < ${state}.controlMemory ? ${ins.$0}: ${state}.signalMemory
        ${state}.controlMemory = ${ins.$1}
    `,

    messageReceivers: ({ state }, { msg }) => ({
        '0_message': AnonFunc([ Var(msg.Message, `m`) ], `void`)`
            if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'set'
            ) {
                ${state}.signalMemory = ${msg.readFloatToken}(m, 1)
                return
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'reset'
            ) {
                ${state}.controlMemory = ${msg.readFloatToken}(m, 1)
                return
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'reset'
            ) {
                ${state}.controlMemory = 1e20
                return
            }
        `,
    }),
}

export { builder, nodeImplementation, NodeArguments }