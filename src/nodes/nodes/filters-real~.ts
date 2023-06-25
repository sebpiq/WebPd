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

import { Code, NodeImplementation, NodeImplementations } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'

interface NodeArguments {
    initValue: number
}
const stateVariables = {
    lastInput: 1,
    lastOutput: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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
    configureMessageToSignalConnection: (inletId, { initValue }) => {
        if (inletId === '1') {
            return { initialSignalValue: initValue }
        }
        return undefined
    },
}

const makeNodeImplementation = ({
    generateOperation,
}: {
    generateOperation: (
        input: Code,
        coeff: Code,
        lastOutput: Code,
        lastInput: Code,
    ) => Code
}): _NodeImplementation => {

    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({
        state,
        macros: { Var },
    }) => `
        let ${Var(state.lastOutput, 'Float')} = 0
        let ${Var(state.lastInput, 'Float')} = 0
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = ({ ins, state, outs }) => `
        ${state.lastOutput} = ${outs.$0} = ${generateOperation(ins.$0, ins.$1, state.lastOutput, state.lastInput)}
        ${state.lastInput} = ${ins.$0}
    `

    return {
        loop,
        stateVariables,
        declare,
    }
}

// ------------------------------------------------------------------- //
const builders = {
    'rpole~': builder,
    'rzero~': builder,
    'rzero_rev~': builder,
}

const nodeImplementations: NodeImplementations = {
    'rpole~': makeNodeImplementation({
        generateOperation: (input, coeff, lastOutput) => `${input} + ${coeff} * ${lastOutput}`,
    }),
    'rzero~': makeNodeImplementation({
        generateOperation: (input, coeff, _, lastInput) => `${input} - ${coeff} * ${lastInput}`,
    }),
    'rzero_rev~': makeNodeImplementation({
        generateOperation: (input, coeff, _, lastInput) => `${lastInput} - ${coeff} * ${input}`
    }),
}

export { builders, nodeImplementations, NodeArguments }
