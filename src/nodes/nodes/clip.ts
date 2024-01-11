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
import { AnonFunc, Class, Sequence, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    minValue: number
    maxValue: number
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        minValue: assertOptionalNumber(args[0]) || 0,
        maxValue: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('clip')

const nodeImplementation: _NodeImplementation = {
    stateInitialization: ({ node: { args }}) => 
        Var(variableNames.stateClass, '', `{
            minValue: ${args.minValue},
            maxValue: ${args.maxValue},
        }`),
    
    messageReceivers: ({ snds, state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${snds[0]}(msg_floats([
                    Math.max(
                        Math.min(
                            ${state}.maxValue, 
                            msg_readFloatToken(m, 0)
                        ), 
                        ${state}.minValue
                    )
                ]))
                return
            }
        `,
    
        '1': coldFloatInlet(`${state}.minValue`),
        '2': coldFloatInlet(`${state}.maxValue`),
    }),

    dependencies: [
        () => Sequence([
            Class(variableNames.stateClass, [
                Var('Float', 'minValue'), 
                Var('Float', 'maxValue'), 
            ]),
        ])
    ],
}

export { builder, nodeImplementation, NodeArguments }
