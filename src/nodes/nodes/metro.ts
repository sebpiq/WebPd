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

import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils, actionUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, NodeImplementation, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    rate: number
    unitAmount: number
    unit: string
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        rate: assertOptionalNumber(pdNode.args[0]) || 0,
        unitAmount: assertOptionalNumber(pdNode.args[1]) || 1,
        unit: assertOptionalString(pdNode.args[2]) || 'msec',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------ node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ ns }, { msg, sked }) => 
        Class(ns.State, [
            Var(`Float`, `rate`, 0),
            Var(`Float`, `sampleRatio`, 1),
            Var(`Int`, `skedId`, sked.ID_NULL),
            Var(`Float`, `realNextTick`, -1),
            Var(msg.Handler, `snd0`, AnonFunc([Var(msg.Message, `m`)])``),
            Var(sked.Callback, `tickCallback`, AnonFunc()``),
        ]),

    initialization: (
        {
            ns,
            node: { args }, 
            state, 
            snds,
        }, 
        { core }
    ) => 
        ast`
            ${state}.snd0 = ${snds.$0}
            ${state}.sampleRatio = computeUnitInSamples(${core.SAMPLE_RATE}, ${args.unitAmount}, "${args.unit}")
            ${ns.setRate}(${state}, ${args.rate})
            ${state}.tickCallback = ${AnonFunc()`
                ${ns.scheduleNextTick}(${state})
            `}
        `,
    
    messageReceivers: (
        { 
            ns,
            state,
        }, {
            core,
            msg,
            bangUtils,
            actionUtils,
        }
    ) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.getLength}(m) === 1) {
                if (
                    (${msg.isFloatToken}(m, 0) && ${msg.readFloatToken}(m, 0) === 0)
                    || ${actionUtils.isAction}(m, 'stop')
                ) {
                    ${ns.stop}(${state})
                    return
    
                } else if (
                    ${msg.isFloatToken}(m, 0)
                    || ${bangUtils.isBang}(m)
                ) {
                    ${state}.realNextTick = toFloat(${core.FRAME})
                    ${ns.scheduleNextTick}(${state})
                    return
                }
            }
        `,
    
        '1': coldFloatInletWithSetter(ns.setRate, state, msg),
    }),

    core: ({ ns }, { bangUtils, commons, sked }) => 
        Sequence([
            // Time units are all expressed in samples here
            Func(ns.setRate, [
                Var(ns.State, `state`),
                Var(`Float`, `rate`),
            ], 'void')`
                state.rate = Math.max(rate, 0)
            `,
        
            Func(ns.scheduleNextTick, [
                Var(ns.State, `state`),
            ], 'void')`
                state.snd0(${bangUtils.bang}())
                state.realNextTick = state.realNextTick + state.rate * state.sampleRatio
                state.skedId = ${commons.waitFrame}(
                    toInt(Math.round(state.realNextTick)), 
                    state.tickCallback,
                )
            `,
        
            Func(ns.stop, [
                Var(ns.State, `state`),
            ], 'void')`
                if (state.skedId !== ${sked.ID_NULL}) {
                    ${commons.cancelWaitFrame}(state.skedId)
                    state.skedId = ${sked.ID_NULL}
                }
                state.realNextTick = 0
            `,
        ]),

    dependencies: [
        computeUnitInSamples,
        bangUtils,
        actionUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
