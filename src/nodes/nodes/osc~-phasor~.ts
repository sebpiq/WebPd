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

import { Code, stdlib } from '@webpd/compiler'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { Func, Var, ast } from '@webpd/compiler/src/ast/declare'

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

    // ------------------------------ generateDeclarations ------------------------------ //
    const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
        state,
        globs,
    }) => ast`
        ${Var('Float', state.phase, 0)}
        ${Var('Float', state.J, 0)}

        ${Func(state.funcSetPhase, [
            Var('Float', 'phase')
        ], 'void')`
            ${state.phase} = phase % 1.0${coeff ? ` * ${coeff}`: ''}
        `}

        commons_waitEngineConfigure(() => {
            ${state.J} = ${coeff ? `${coeff}`: '1'} / ${globs.sampleRate}
        })
    `

    // ------------------------------- generateLoop ------------------------------ //
    const generateLoop: _NodeImplementation['generateLoop'] = ({ ins, state, outs }) => ast`
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += (${state.J} * ${ins.$0})
    `

    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ globs, state }) => ({
        '1': coldFloatInletWithSetter(state.funcSetPhase),
    })

    return {
        generateDeclarations,
        generateMessageReceivers,
        generateLoop,
        stateVariables,
        dependencies: [stdlib.commonsWaitEngineConfigure]
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
