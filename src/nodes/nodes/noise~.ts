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
import { AnonFunc, Var } from '@webpd/compiler'

interface NodeArguments {}
type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : implement seed
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => {
        return {
            inlets: {
                '0': { type: 'message', id: '0' },
            },
            outlets: {
                '0': { type: 'signal', id: '0' },
            },
        }
    },
}

// ------------------------------- generateLoop ------------------------------ //
const generateLoopInline: _NodeImplementation['generateLoopInline'] = () => `Math.random() * 2 - 1`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ globs }) => ({
    '0': AnonFunc([Var('Message', 'm')])`
        if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'seed'
        ) {
            console.log('WARNING : seed not implemented yet for [noise~]')
            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    generateLoopInline, 
    generateMessageReceivers,
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}