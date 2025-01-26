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
import { bangUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, NodeImplementation, Sequence, stdlib } from '@webpd/compiler'
import { ast, Var, Func, AnonFunc, ConstVar } from '@webpd/compiler'

interface NodeArguments { 
    delay: number,
    unitAmount: number,
    unit: string,
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        delay: assertOptionalNumber(pdNode.args[0]) || 0,
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
        isPushingMessages: true
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ ns }, { sked }) => 
        Class(ns.State, [
            Var(`Float`, `delay`, 0),
            Var(`Float`, `sampleRatio`, 1),
            Var(sked.Id, `scheduledBang`, sked.ID_NULL),
        ]),

    initialization: ({ ns, node: { args }, state }, { core }) => ast`
        ${state}.sampleRatio = computeUnitInSamples(${core.SAMPLE_RATE}, ${args.unitAmount}, "${args.unit}")
        ${ns.setDelay}(${state}, ${args.delay})
    `,

    messageReceivers: ({ ns, state, snds }, { core, msg, bangUtils }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.getLength}(m) === 1) {
                if (${msg.isStringToken}(m, 0)) {
                    ${ConstVar(`string`, `action`, `${msg.readStringToken}(m, 0)`)}
                    if (action === 'bang' || action === 'start') {
                        ${ns.scheduleDelay}(
                            ${state}, 
                            () => ${snds.$0}(${bangUtils.bang}()),
                            ${core.FRAME},
                        )
                        return
                    } else if (action === 'stop') {
                        ${ns.stop}(${state})
                        return
                    }
                    
                } else if (${msg.isFloatToken}(m, 0)) {
                    ${ns.setDelay}(${state}, ${msg.readFloatToken}(m, 0))
                    ${ns.scheduleDelay}(
                        ${state},
                        () => ${snds.$0}(${bangUtils.bang}()),
                        ${core.FRAME},
                    )
                    return 
                }
            
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'tempo'
            ) {
                ${state}.sampleRatio = computeUnitInSamples(
                    ${core.SAMPLE_RATE}, 
                    ${msg.readFloatToken}(m, 1), 
                    ${msg.readStringToken}(m, 2)
                )
                return
            }
        `,
        
        '1': coldFloatInletWithSetter(ns.setDelay, state, msg)
    }),

    core: ({ ns }, { sked, commons }) => 
        Sequence([
            Func(ns.setDelay, [
                Var(ns.State, `state`),
                Var(`Float`, `delay`),
            ], 'void')`
                state.delay = Math.max(0, delay)
            `,

            Func(ns.scheduleDelay, [
                Var(ns.State, `state`),
                Var(sked.Callback, `callback`),
                Var(`Int`, `currentFrame`),
            ], 'void')`
                if (state.scheduledBang !== ${sked.ID_NULL}) {
                    ${ns.stop}(state)
                }
                state.scheduledBang = ${commons.waitFrame}(toInt(
                    Math.round(
                        toFloat(currentFrame) + state.delay * state.sampleRatio)),
                    callback
                )
            `,

            Func(ns.stop, [
                Var(ns.State, `state`),
            ], 'void')`
                ${commons.cancelWaitFrame}(state.scheduledBang)
                state.scheduledBang = ${sked.ID_NULL}
            `
        ]),

    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}