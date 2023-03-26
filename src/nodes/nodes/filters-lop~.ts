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
import {
    coldFloatInletWithSetter,
} from '../standard-message-receivers'

interface NodeArguments {
    frequency: number
}
const stateVariables = {
    coeff: 1,
    previous: 1,
    funcSetFreq: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    globs,
    node: { args },
    macros: { Var, Func },
}) => `
    let ${Var(state.previous, 'Float')} = 0
    let ${Var(state.coeff, 'Float')} = 0

    function ${state.funcSetFreq} ${Func([
        Var('freq', 'Float')
    ], 'void')} {
        ${state.coeff} = Math.max(Math.min(freq * 2 * Math.PI / ${globs.sampleRate}, 1), 0)
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetFreq}(${args.frequency})
    })
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, state, outs }) => `
    ${state.previous} = ${outs.$0} = ${state.coeff} * ${ins.$0} + (1 - ${state.coeff}) * ${state.previous}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ globs, state }) => ({
    '1': coldFloatInletWithSetter(globs.m, state.funcSetFreq),
})

const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
}

// ------------------------------------------------------------------- //
export { builder, nodeImplementation, NodeArguments }
