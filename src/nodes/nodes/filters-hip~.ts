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
import { ast, Class, ConstVar, Sequence, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    initValue: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : very inneficient compute coeff at each iter
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, nodeArgs) => {
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.initValue }
        }
        return undefined
    },
}

// ------------------------------- generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('hip_t')

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Class(variableNames.stateClass, [
        Var('Float', 'previous'),
        Var('Float', 'current'),
        Var('Float', 'coeff'),
        Var('Float', 'normal'),
    ]),
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args }, state }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            previous: 0,
            current: 0,
            coeff: 0,
            normal: 0,
        }`)}
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, state, outs, globs }) => ast`
    ${state}.coeff = Math.min(Math.max(1 - ${ins.$1} * (2 * Math.PI) / ${globs.sampleRate}, 0), 1)
    ${state}.normal = 0.5 * (1 + ${state}.coeff)
    ${state}.current = ${ins.$0} + ${state}.coeff * ${state}.previous
    ${outs.$0} = ${state}.normal * (${state}.current - ${state}.previous)
    ${state}.previous = ${state}.current
`

const nodeImplementation: _NodeImplementation = {
    initialization: initialization,
    loop: loop,
    dependencies: [nodeCore],
}

// ------------------------------------------------------------------- //
export { builder, nodeImplementation, NodeArguments }
