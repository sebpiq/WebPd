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

import { Class, Code, Sequence, stdlib } from '@webpd/compiler'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { Func, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    frequency: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

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

// ------------------------------ node implementation ------------------------------ //
const makeNodeImplementation = ({
    alphaName,
    coeff,
    generateOperation,
}: {
    alphaName: string,
    coeff: Code,
    generateOperation: (phase: Code) => Code,
}): _NodeImplementation => {
    const nodeImplementation: _NodeImplementation = {
        flags: {
            alphaName,
        },

        state: ({ ns }) => 
            Class(ns.State, [
                Var(`Float`, `phase`, 0),
                Var(`Float`, `step`, 0),
            ]),

        initialization: ({ ns, state }) => ast`
            ${ns.setStep}(${state}, 0)
        `,

        messageReceivers: ({ ns, state }, { msg }) => ({
            '1': coldFloatInletWithSetter(ns.setPhase, state, msg),
        }),

        dsp: ({ ns, state, outs, ins }) => ({
            inlets: {
                '0': ast`${ns.setStep}(${state}, ${ins.$0})`
            },
            loop: ast`
                ${outs.$0} = ${generateOperation(`${state}.phase`)}
                ${state}.phase += ${state}.step
            `
        }),

        core: ({ ns }, { core }) => 
            Sequence([
                Func(ns.setStep, [
                    Var(ns.State, `state`),
                    Var(`Float`, `freq`),
                ])`
                    state.step = (${coeff} / ${core.SAMPLE_RATE}) * freq
                `,

                Func(ns.setPhase, [
                    Var(ns.State, `state`),
                    Var(`Float`, `phase`),
                ])`
                    state.phase = phase % 1.0${coeff ? ` * ${coeff}`: ''}
                `,
            ]),
    }

    return nodeImplementation
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'osc~': makeNodeImplementation({
        alphaName: 'osc_t',
        coeff: '2 * Math.PI',
        generateOperation: (phase: Code) => `Math.cos(${phase})`
    }),
    'phasor~': makeNodeImplementation({
        alphaName: 'phasor_t',
        coeff: '1',
        generateOperation: (phase: Code) => `${phase} % 1`
    }),
}

const builders = {
    'osc~': builder,
    'phasor~': builder,
}

export { builders, nodeImplementations, NodeArguments }
