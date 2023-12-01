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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { Class, ConstVar, Func, Sequence, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    frequency: number,
    Q: number,
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : this uses bp~ implementation, not vcf. Rewrite using pd's implementation : 
// https://github.com/pure-data/pure-data/blob/master/src/d_osc.c
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        frequency: assertOptionalNumber(args[0]) || 0,
        Q: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
}

// ------------------------------- generateDeclarations ------------------------------ //

const variableNames = generateVariableNamesNodeType('vcf_t', [
    'updateCoefs',
    'setFrequency',
    'setQ',
])

const nodeCore: GlobalCodeGenerator = ({ globs }) => Sequence([
    Class(variableNames.stateClass, [
        Var('Float', 'frequency'),
        Var('Float', 'Q'),
        Var('Float', 'coef1'),
        Var('Float', 'coef2'),
        Var('Float', 'gain'),
        Var('Float', 'y'),
        Var('Float', 'ym1'),
        Var('Float', 'ym2'),
    ]),

    Func(variableNames.updateCoefs, [
        Var(variableNames.stateClass, 'state'),
    ], 'void')`
        ${Var('Float', 'omega', `state.frequency * (2.0 * Math.PI) / ${globs.sampleRate}`)}
        ${Var('Float', 'oneminusr', `state.Q < 0.001 ? 1.0 : Math.min(omega / state.Q, 1)`)}
        ${Var('Float', 'r', `1.0 - oneminusr`)}
        ${Var('Float', 'sigbp_qcos', `(omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
            (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
            : 0`)}

        state.coef1 = 2.0 * sigbp_qcos * r
        state.coef2 = - r * r
        state.gain = 2 * oneminusr * (oneminusr + r * omega)
    `,

    Func(variableNames.setFrequency, [
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'frequency'),
    ], 'void')`
        state.frequency = (frequency < 0.001) ? 10: frequency
        ${variableNames.updateCoefs}()
    `,

    Func(variableNames.setQ, [
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'Q'),
    ], 'void')`
        state.Q = Math.max(Q, 0)
        ${variableNames.updateCoefs}()
    `,
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args }, state }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            frequency: ${args.frequency},
            Q: ${args.Q},
            coef1: 0,
            coef2: 0,
            gain: 0,
            y: 0,
            ym1: 0,
            ym2: 0,
        }`)}
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, outs, state }) => ast`
    ${variableNames.setFrequency}(${state}, ${ins.$1})
    ${state}.y = ${ins.$0} + ${state}.coef1 * ${state}.ym1 + ${state}.coef2 * ${state}.ym2
    ${outs.$1} = ${outs.$0} = ${state}.gain * ${state}.y
    ${state}.ym2 = ${state}.ym1
    ${state}.ym1 = ${state}.y
`

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ state }) => ({
    '2': coldFloatInletWithSetter(variableNames.setQ, state),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    initialization: initialization,
    loop: loop,
    messageReceivers: messageReceivers,
    dependencies: [nodeCore],
}

export { builder, nodeImplementation, NodeArguments }