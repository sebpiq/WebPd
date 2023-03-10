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

import { Code, DspGraph } from '@webpd/compiler-js'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInletWithSetter } from '../standard-message-receivers'

interface NodeArguments {
    frequency: number
}
const stateVariables = {
    phase: 1,
    frequency: 1,
    J: 1,
    K: 1,
    funcSetFrequency: 1,
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
            '0_message': { type: 'message', id: '0_message' },
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
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

const makeNodeImplementation = ({
    coeff,
    generateOperation,
}: {
    coeff?: Code,
    generateOperation: (phase: Code) => Code,
}): _NodeImplementation => {

    // ------------------------------ declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = (context) => {
        const { state, macros: { Var, Func }} = context
        return (_hasSignalInput(context.node)
            ? declareSignal(context)
            : declareMessage(context)) + `
                function ${state.funcSetPhase} ${Func([
                    Var('phase', 'Float')
                ], 'void')} {${state.phase} = phase % 1.0${coeff ? ` * ${coeff}`: ''}}
            `
    }

    const declareSignal: _NodeImplementation['declare'] = ({
        state,
        globs,
        macros: { Var },
    }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.J, 'Float')}

        commons_waitEngineConfigure(() => {
            ${state.J} = ${coeff ? `${coeff}`: '1'} / ${globs.sampleRate}
        })
    `

    const declareMessage: _NodeImplementation['declare'] = ({
        state,
        globs,
        node: { args },
        macros: { Func, Var },
    }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.frequency, 'Float')} = ${args.frequency}
        let ${Var(state.K, 'Float')} = 0

        function ${state.funcSetFrequency} ${Func([
            Var('frequency', 'Float')
        ], 'void')} {
            ${state.frequency} = frequency
            ${state.K} = ${coeff ? `${coeff} * `: ''}${state.frequency} / ${globs.sampleRate}
        }

        commons_waitEngineConfigure(() => {
            ${state.funcSetFrequency}(${state.frequency})
        })
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = (context) => 
        _hasSignalInput(context.node)
            ? loopSignal(context)
            : loopMessage(context)

    const loopSignal: _NodeImplementation['loop'] = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += (${state.J} * ${ins.$0})
    `

    // Take only the last received frequency message (first in the list)
    const loopMessage: _NodeImplementation['loop'] = ({ state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += ${state.K}
    `

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({ globs, state }) => ({
        '0_message': coldFloatInletWithSetter(globs.m, state.funcSetFrequency),
        '1': coldFloatInletWithSetter(globs.m, state.funcSetPhase),
    })

    return {
        declare,
        messages,
        loop,
        stateVariables,
    }
}

// ------------------------------------------------------------------- //
const _hasSignalInput = (node: DspGraph.Node<NodeArguments>) =>
    node.sources['0'] && node.sources['0'].length

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
