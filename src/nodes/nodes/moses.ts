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
import { assertOptionalNumber } from '../validation'
import { coldFloatInlet } from '../standard-message-receivers'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    threshold: number
}
const stateVariables = {
    threshold: 1
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    node,
    state,
}) => ast`
    ${Var('Float', state.threshold, node.args.threshold)}
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ snds, globs, state }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${ConstVar('Float', 'value', 'msg_readFloatToken(m, 0)')}
            if (value >= ${state.threshold}) {
                ${snds[1]}(msg_floats([value]))
            } else {
                ${snds[0]}(msg_floats([value]))
            }
            return
        }
    `,

    '1': coldFloatInlet(state.threshold),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { generateMessageReceivers, stateVariables, generateDeclarations }

export { builder, nodeImplementation, NodeArguments }
