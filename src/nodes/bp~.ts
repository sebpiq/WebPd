/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'

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
    funcClear: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
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
const loop: _NodeImplementation['loop'] = ({ ins, outs, state }) => `
    ${state.y} = ${ins.$0} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': `
        if (
            msg_isMatching(${globs.m})
            && msg_readStringToken(${globs.m}, 0) === 'clear'
        ) {
            ${state.funcClear}()
            return 
        }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetFrequency),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetQ),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
}

export { builder, nodeImplementation, NodeArguments }