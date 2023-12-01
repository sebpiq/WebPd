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
import { ast, Var, Func, AnonFunc, Class, ConstVar, Sequence } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    frequency: number,
    Q: number,
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        frequency: assertOptionalNumber(args[0]) || 0,
        Q: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------- generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('filter_bp_t', [
    'updateCoefs',
    'setFrequency',
    'setQ',
    'clear',
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
        ${variableNames.updateCoefs}(state)
    `,

    Func(variableNames.setQ, [
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'Q'),
    ], 'void')`
        state.Q = Math.max(Q, 0)
        ${variableNames.updateCoefs}(state)
    `,

    Func(variableNames.clear, [
        Var(variableNames.stateClass, 'state'),
    ], 'void')`
        state.ym1 = 0
        state.ym2 = 0
    `
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

        commons_waitEngineConfigure(() => {
            ${variableNames.updateCoefs}(${state})
        })
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, outs, state }) => ast`
    ${state}.y = ${ins.$0} + ${state}.coef1 * ${state}.ym1 + ${state}.coef2 * ${state}.ym2
    ${outs.$0} = ${state}.gain * ${state}.y
    ${state}.ym2 = ${state}.ym1
    ${state}.ym1 = ${state}.y
`

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ state }) => ({
    '0_message': AnonFunc([ Var('Message', 'm') ], 'void')`
        if (
            msg_isMatching(m)
            && msg_readStringToken(m, 0) === 'clear'
        ) {
            ${variableNames.clear}()
            return 
        }
    `,
    '1': coldFloatInletWithSetter(variableNames.setFrequency, state),
    '2': coldFloatInletWithSetter(variableNames.setQ, state),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop: loop,
    messageReceivers: messageReceivers,
    initialization: initialization,
    dependencies: [nodeCore]
}

export { builder, nodeImplementation, NodeArguments }