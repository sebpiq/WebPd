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
import { bangUtils } from '../global-code/core'
import { AnonFunc, Var, ast } from '@webpd/compiler'

interface NodeArguments {}
const stateVariables = {
    continueIter: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    state,
}) => ast`
    ${Var('boolean', state.continueIter, 'true')}
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ snds, globs, state }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_isBang(m)) {
            ${state.continueIter} = true
            while (${state.continueIter}) {
                ${snds[0]}(msg_bang())
            }
            return

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${state.continueIter} = true
            ${Var('Int', 'maxIterCount', 'toInt(msg_readFloatToken(m, 0))')}
            ${Var('Int', 'iterCount', '0')}
            while (${state.continueIter} && iterCount++ < maxIterCount) {
                ${snds[0]}(msg_bang())
            }
            return
        }
    `,

    '1': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_isBang(m)) {
            ${state.continueIter} = false
            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateMessageReceivers,
    stateVariables,
    generateDeclarations,
    dependencies: [bangUtils],
}

export { builder, nodeImplementation, NodeArguments }
