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

import { NodeImplementation } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInlet, coldFloatInletWithSetter } from '../standard-message-receivers'
import { DspGraph, functional } from '@webpd/compiler'

interface NodeArguments {
    frequency: number,
    Q: number,
}
const stateVariables = {
    inputValue: 1,
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
    funcClear: 1,
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
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'signal', id: '1' },
            '1_message': { type: 'message', id: '1_message' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        if (inletId === '1') {
            return '1_message'
        }
        return undefined
    },
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ 
    state, 
    globs,
    node: { args }, 
    macros: { Var, Func }}) => `
    let ${Var(state.inputValue, 'Float')} = 0
    let ${Var(state.frequency, 'Float')} = ${args.frequency}
    let ${Var(state.Q, 'Float')} = ${args.Q}
    let ${Var(state.coef1, 'Float')} = 0
    let ${Var(state.coef2, 'Float')} = 0
    let ${Var(state.gain, 'Float')} = 0
    let ${Var(state.y, 'Float')} = 0
    let ${Var(state.ym1, 'Float')} = 0
    let ${Var(state.ym2, 'Float')} = 0

    function ${state.funcUpdateCoefs} ${Func([], 'void')} {
        let ${Var('omega', 'Float')} = ${state.frequency} * (2.0 * Math.PI) / ${globs.sampleRate};
        let ${Var('oneminusr', 'Float')} = ${state.Q} < 0.001 ? 1.0 : Math.min(omega / ${state.Q}, 1)
        let ${Var('r', 'Float')} = 1.0 - oneminusr
        let ${Var('sigbp_qcos', 'Float')} = (omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
            (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
            : 0

        ${state.coef1} = 2.0 * sigbp_qcos * r
        ${state.coef2} = - r * r
        ${state.gain} = 2 * oneminusr * (oneminusr + r * omega)
    }

    function ${state.funcSetFrequency} ${Func([
        Var('frequency', 'Float')
    ], 'void')} {
        ${state.frequency} = (frequency < 0.001) ? 10: frequency
        ${state.funcUpdateCoefs}()
    }

    function ${state.funcSetQ} ${Func([
        Var('Q', 'Float')
    ], 'void')} {
        ${state.Q} = Math.max(Q, 0)
        ${state.funcUpdateCoefs}()
    }

    function ${state.funcClear} ${Func([], 'void')} {
        ${state.ym1} = 0
        ${state.ym2} = 0
    }

    commons_waitEngineConfigure(() => {
        ${state.funcUpdateCoefs}()
    })
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ node, ins, outs, state }) => `
    ${functional.renderIf(
        _hasSignalInput1(node), 
        `${state.funcSetFrequency}(${ins.$1})`
    )}
    ${state.y} = ${_hasSignalInput0(node) ? ins.$0 : state.inputValue} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$1} = ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': coldFloatInlet(globs.m, state.inputValue),
    '1_message': coldFloatInletWithSetter(globs.m, state.funcSetFrequency),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetQ),
})

// ------------------------------------------------------------------- //
const _hasSignalInput0 = (node: DspGraph.Node<NodeArguments>) =>
    node.sources['0'] && node.sources['0'].length

const _hasSignalInput1 = (node: DspGraph.Node<NodeArguments>) =>
    node.sources['1'] && node.sources['1'].length

const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
}

export { builder, nodeImplementation, NodeArguments }