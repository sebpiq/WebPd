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

import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../global-code/core'
import { AnonFunc, Sequence, Var, ConstVar, ast, Class } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    initValue: number
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('change')

const nodeImplementation: _NodeImplementation = {
    initialization: ({ node: { args }, state }) => 
        ast`
            ${ConstVar(variableNames.stateClass, state, `{
                currentValue: ${args.initValue}
            }`)}
        `,

    messageReceivers: ({
        snds,
        state,
    }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${ConstVar('Float', 'newValue', 'msg_readFloatToken(m, 0)')}
                if (newValue !== ${state}.currentValue) {
                    ${state}.currentValue = newValue
                    ${snds[0]}(msg_floats([${state}.currentValue]))
                }
                return
    
            } else if (msg_isBang(m)) {
                ${snds[0]}(msg_floats([${state}.currentValue]))
                return 
    
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${state}.currentValue = msg_readFloatToken(m, 1)
                return
            }
        `,
    }),

    dependencies: [
        bangUtils, 
        () => Sequence([
            Class(variableNames.stateClass, [
                Var('Float', 'currentValue'), 
            ]),
        ])
    ],
}

export { builder, nodeImplementation, NodeArguments }
