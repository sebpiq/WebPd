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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { Func, Var, ast } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {
    frequency: number,
    Q: number,
}
const stateVariables = {
    frequency: 1,
    Q: 1,
    // Output value Y[n]
    y: 1,
    // Last output value Y[n-1]
    ym1: 1,
    // Last output value Y[n-2]
    ym2: 1,
    coef1: 1,
    coef2: 1,
    gain: 1,
    funcSetQ: 1,
    funcSetFrequency: 1,
    funcUpdateCoefs: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ 
    state, 
    globs,
    node: { args }
}) => ast`
    ${Var('Float', state.frequency, args.frequency)}
    ${Var('Float', state.Q, args.Q)}
    ${Var('Float', state.coef1, 0)}
    ${Var('Float', state.coef2, 0)}
    ${Var('Float', state.gain, 0)}
    ${Var('Float', state.y, 0)}
    ${Var('Float', state.ym1, 0)}
    ${Var('Float', state.ym2, 0)}

    ${Func(state.funcUpdateCoefs, [], 'void')`
        ${Var('Float', 'omega', `${state.frequency} * (2.0 * Math.PI) / ${globs.sampleRate}`)}
        ${Var('Float', 'oneminusr', `${state.Q} < 0.001 ? 1.0 : Math.min(omega / ${state.Q}, 1)`)}
        ${Var('Float', 'r', `1.0 - oneminusr`)}
        ${Var('Float', 'sigbp_qcos', `(omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
            (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
            : 0`)}

        ${state.coef1} = 2.0 * sigbp_qcos * r
        ${state.coef2} = - r * r
        ${state.gain} = 2 * oneminusr * (oneminusr + r * omega)
    `}

    ${Func(state.funcSetFrequency, [
        Var('Float', 'frequency')
    ], 'void')`
        ${state.frequency} = (frequency < 0.001) ? 10: frequency
        ${state.funcUpdateCoefs}()
    `}

    ${Func(state.funcSetQ, [
        Var('Float', 'Q')
    ], 'void')`
        ${state.Q} = Math.max(Q, 0)
        ${state.funcUpdateCoefs}()
    `}
`

// ------------------------------- generateLoop ------------------------------ //
const generateLoop: _NodeImplementation['generateLoop'] = ({ ins, outs, state }) => ast`
    ${state.funcSetFrequency}(${ins.$1})
    ${state.y} = ${ins.$0} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$1} = ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs }) => ({
    '2': coldFloatInletWithSetter(state.funcSetQ),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateLoop,
    stateVariables,
    generateMessageReceivers,
    generateDeclarations,
}

export { builder, nodeImplementation, NodeArguments }