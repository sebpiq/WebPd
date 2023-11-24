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
import { coldFloatInlet } from '../standard-message-receivers'
import { ast, Class, ConstVar, Sequence, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    initValue: number,
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
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('sig_t')

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Class(variableNames.stateClass, [
        Var('Float', 'currentValue')
    ]),
])

const generateInitialization: _NodeImplementation['generateInitialization'] = ({ node: { args }, state }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            currentValue: ${args.initValue}
        }`)}
    `

// ------------------------------- generateLoop ------------------------------ //
const generateLoopInline: _NodeImplementation['generateLoopInline'] = ({ state }) => 
    `${state}.currentValue`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state }) => ({
    '0': coldFloatInlet(`${state}.currentValue`),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateInitialization,
    generateLoopInline,
    generateMessageReceivers,
    dependencies: [
        nodeCore,
    ]
}

export { builder, nodeImplementation, NodeArguments }