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
import {
    coldFloatInletWithSetter,
} from '../standard-message-receivers'
import { ast, Class, ConstVar, Func, Sequence, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    frequency: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : very inneficient compute coeff at each iter
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        frequency: assertOptionalNumber(args[0]) || 0,
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
            return { initialSignalValue: nodeArgs.frequency }
        }
        return undefined
    },
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('lop_t', ['setFreq'])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: () => 
        Var(variableNames.stateClass, '', `{
            previous: 0,
            coeff: 0,
        }`),

    loop: ({ ins, state, outs }) => ast`
        ${variableNames.setFreq}(${state}, ${ins.$1})
        ${state}.previous = ${outs.$0} = ${state}.coeff * ${ins.$0} + (1 - ${state}.coeff) * ${state}.previous
    `,

    messageReceivers: ({ state }) => ({
        '1': coldFloatInletWithSetter(variableNames.setFreq, state),
    }),

    dependencies: [
        ({ globs }) => Sequence([
            Class(variableNames.stateClass, [
                Var('Float', 'previous'),
                Var('Float', 'coeff'),
            ]),
        
            Func(variableNames.setFreq, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'freq'),
            ], 'void')`
                state.coeff = Math.max(Math.min(freq * 2 * Math.PI / ${globs.sampleRate}, 1), 0)
            `
        ])
    ],
}

// ------------------------------------------------------------------- //
export { builder, nodeImplementation, NodeArguments }
