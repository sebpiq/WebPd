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
import { ast, Var, Func, AnonFunc, Class, Sequence } from '@webpd/compiler'

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

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'filters_bp_t',
    },

    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Float`, `frequency`, args.frequency),
            Var(`Float`, `Q`, args.Q),
            Var(`Float`, `coef1`, 0),
            Var(`Float`, `coef2`, 0),
            Var(`Float`, `gain`, 0),
            Var(`Float`, `y`, 0),
            Var(`Float`, `ym1`, 0),
            Var(`Float`, `ym2`, 0),
        ]),
    
    initialization: ({ ns, state }) => ast`
        ${ns.updateCoefs}(${state})
    `,

    dsp: ({ ins, outs, state }) => ast`
        ${state}.y = ${ins.$0} + ${state}.coef1 * ${state}.ym1 + ${state}.coef2 * ${state}.ym2
        ${outs.$0} = ${state}.gain * ${state}.y
        ${state}.ym2 = ${state}.ym1
        ${state}.ym1 = ${state}.y
    `,

    messageReceivers: ({ ns, state }, { msg }) => ({
        '0_message': AnonFunc([ Var(msg.Message, `m`) ], `void`)`
            if (
                ${msg.isMatching}(m)
                && ${msg.readStringToken}(m, 0) === 'clear'
            ) {
                ${ns.clear}()
                return 
            }
        `,
        '1': coldFloatInletWithSetter(ns.setFrequency, state, msg),
        '2': coldFloatInletWithSetter(ns.setQ, state, msg),
    }),

    core: ({ ns }, { core }) => 
        Sequence([
            Func(ns.updateCoefs, [
                Var(ns.State, `state`),
            ], 'void')`
                ${Var(`Float`, `omega`, `state.frequency * (2.0 * Math.PI) / ${core.SAMPLE_RATE}`)}
                ${Var(`Float`, `oneminusr`, `state.Q < 0.001 ? 1.0 : Math.min(omega / state.Q, 1)`)}
                ${Var(`Float`, `r`, `1.0 - oneminusr`)}
                ${Var(`Float`, `sigbp_qcos`, `(omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
                    (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
                    : 0`)}
        
                state.coef1 = 2.0 * sigbp_qcos * r
                state.coef2 = - r * r
                state.gain = 2 * oneminusr * (oneminusr + r * omega)
            `,
        
            Func(ns.setFrequency, [
                Var(ns.State, `state`),
                Var(`Float`, `frequency`),
            ], 'void')`
                state.frequency = (frequency < 0.001) ? 10: frequency
                ${ns.updateCoefs}(state)
            `,
        
            Func(ns.setQ, [
                Var(ns.State, `state`),
                Var(`Float`, `Q`),
            ], 'void')`
                state.Q = Math.max(Q, 0)
                ${ns.updateCoefs}(state)
            `,
        
            Func(ns.clear, [
                Var(ns.State, `state`),
            ], 'void')`
                state.ym1 = 0
                state.ym2 = 0
            `
        ])
}

export { builder, nodeImplementation, NodeArguments }