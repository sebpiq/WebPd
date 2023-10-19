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

import { Code, coreCode } from '@webpd/compiler'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInletWithSetter } from '../standard-message-receivers'

interface NodeArguments {
    frequency: number
}
const stateVariables = {
    phase: 1,
    J: 1,
    funcSetPhase: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        frequency: assertOptionalNumber(pdNode.args[0]) || 0,
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
    configureMessageToSignalConnection: (inletId, { frequency }) => {
        if (inletId === '0') {
            return { initialSignalValue: frequency }
        }
        return undefined
    },
}

const makeNodeImplementation = ({
    coeff,
    generateOperation,
}: {
    coeff?: Code,
    generateOperation: (phase: Code) => Code,
}): _NodeImplementation => {

    // ------------------------------ declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({
        state,
        globs,
        macros: { Var, Func },
    }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.J, 'Float')}

        function ${state.funcSetPhase} ${Func([
            Var('phase', 'Float')
        ], 'void')} { ${state.phase} = phase % 1.0${coeff ? ` * ${coeff}`: ''} }

        commons_waitEngineConfigure(() => {
            ${state.J} = ${coeff ? `${coeff}`: '1'} / ${globs.sampleRate}
        })
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += (${state.J} * ${ins.$0})
    `

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({ globs, state }) => ({
        '1': coldFloatInletWithSetter(globs.m, state.funcSetPhase),
    })

    return {
        declare,
        messages,
        loop,
        stateVariables,
        globalCode: [coreCode.commonsWaitEngineConfigure]
    }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'osc~': makeNodeImplementation({
        coeff: '2 * Math.PI',
        generateOperation: (phase: Code) => `Math.cos(${phase})`
    }),
    'phasor~': makeNodeImplementation({
        generateOperation: (phase: Code) => `${phase} % 1`
    }),
}

const builders = {
    'osc~': builder,
    'phasor~': builder,
}

export { builders, nodeImplementations, NodeArguments }
