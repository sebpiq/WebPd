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
import { AnonFunc, Class, Var, NodeImplementation } from '@webpd/compiler'

interface NodeArguments {}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
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
            Var(`boolean`, `continueIter`, `true`)
        ]),
    
    messageReceivers: ({ snds, state }, { msg, bangUtils }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${state}.continueIter = true
                while (${state}.continueIter) {
                    ${snds[0]}(${bangUtils.bang}())
                }
                return
    
            } else if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {
                ${state}.continueIter = true
                ${Var(`Int`, `maxIterCount`, `toInt(${msg.readFloatToken}(m, 0))`)}
                ${Var(`Int`, `iterCount`, `0`)}
                while (${state}.continueIter && iterCount++ < maxIterCount) {
                    ${snds[0]}(${bangUtils.bang}())
                }
                return
            }
        `,
    
        '1': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${state}.continueIter = false
                return
            }
        `,
    }),

    dependencies: [
        bangUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
