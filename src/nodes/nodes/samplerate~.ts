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
import { AnonFunc, NodeImplementation, Var } from '@webpd/compiler'

interface NodeArguments {}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// --------------------------- node implementation --------------------------- //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'samplerate_t',
    },

    messageReceivers: ({ snds }, { core, msg, bangUtils }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) { 
                ${snds.$0}(${msg.floats}([${core.SAMPLE_RATE}])) 
                return
            }
        `,
    }),

    dependencies: [
        bangUtils
    ]
}

export { builder, nodeImplementation, NodeArguments }