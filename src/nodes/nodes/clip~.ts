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
import { ast, Var } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {
    minValue: number,
    maxValue: number,
}
const stateVariables = {
    minValue: 1,
    maxValue: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        minValue: assertOptionalNumber(args[0]) || 0,
        maxValue: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    })
}

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ node: { args }, state }) => ast`
    ${Var('Float', state.minValue, args.minValue.toString())}
    ${Var('Float', state.maxValue, args.maxValue.toString())}
`

// ------------------------------- generateLoop ------------------------------ //
const generateLoopInline: _NodeImplementation['generateLoopInline'] = ({ ins, state }) =>
    `Math.max(Math.min(${state.maxValue}, ${ins.$0}), ${state.minValue})`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state }) => ({
    '1': coldFloatInlet(state.minValue),
    '2': coldFloatInlet(state.maxValue),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateLoopInline,
    stateVariables,
    generateMessageReceivers,
    generateDeclarations,
}

export { builder, nodeImplementation, NodeArguments }