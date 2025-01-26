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
import { assertOptionalNumber } from '../validation'
import { actionUtils } from '../global-code/core'
import { linesUtils } from '../global-code/lines'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, NodeImplementation, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    initValue: number
    timeGrainMsec: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

const MIN_GRAIN_MSEC = 20

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
        timeGrainMsec: Math.max(assertOptionalNumber(args[1]) || MIN_GRAIN_MSEC, MIN_GRAIN_MSEC),
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true,
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, ns }, { sked, msg, linesUtils }) => 
        Class(ns.State, [
            Var(linesUtils.LineSegment, `currentLine`, `{
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            }`),
            Var(`Float`, `currentValue`, args.initValue),
            Var(`Float`, `nextSamp`, -1),
            Var(`Int`, `nextSampInt`, -1),
            Var(`Float`, `grainSamp`, 0),
            Var(`Float`, `nextDurationSamp`, 0),
            Var(sked.Id, `skedId`, sked.ID_NULL),
            Var(msg.Handler, `snd0`, ast`${AnonFunc([Var(msg.Message, `m`)])``}`),
            Var(sked.Callback, `tickCallback`, ast`${AnonFunc()``}`),
        ]),
    
    initialization: ({ ns, node: { args }, state, snds }) => 
        ast`
            ${ns.setGrain}(${state}, ${args.timeGrainMsec})
            ${state}.snd0 = ${snds.$0}
            ${state}.tickCallback = ${AnonFunc()`
                ${ns.tick}(${state})
            `}
        `,
    
    messageReceivers: (
        { 
            ns,
            snds, 
            state,
        }, {
            actionUtils, 
            msg
        }
    ) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (
                ${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])
                || ${msg.isMatching}(m, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}])
                || ${msg.isMatching}(m, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}])
            ) {
                ${ns.stopCurrentLine}(${state})
                switch (${msg.getLength}(m)) {
                    case 3:
                        ${ns.setGrain}(${state}, ${msg.readFloatToken}(m, 2))
                    case 2:
                        ${ns.setNextDuration}(${state}, ${msg.readFloatToken}(m, 1))
                    case 1:
                        ${ConstVar(`Float`, `targetValue`, `${msg.readFloatToken}(m, 0)`)}
                        if (${state}.nextDurationSamp === 0) {
                            ${state}.currentValue = targetValue
                            ${snds.$0}(${msg.floats}([targetValue]))
                        } else {
                            ${snds.$0}(${msg.floats}([${state}.currentValue]))
                            ${ns.setNewLine}(${state}, targetValue)
                            ${ns.incrementTime}(${state}, ${state}.currentLine.dx)
                            ${ns.scheduleNextTick}(${state})
                        }
                        
                }
                return
    
            } else if (${actionUtils.isAction}(m, 'stop')) {
                ${ns.stopCurrentLine}(${state})
                return
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'set'
            ) {
                ${ns.stopCurrentLine}(${state})
                ${state}.currentValue = ${msg.readFloatToken}(m, 1)
                return
            }
        `,
    
        '1': coldFloatInletWithSetter(ns.setNextDuration, state, msg),
        '2': coldFloatInletWithSetter(ns.setGrain, state, msg),
    }),

    core: ({ ns }, { commons, core, sked, msg, linesUtils, points }) => 
        Sequence([
            Func(ns.setNewLine, [
                Var(ns.State, `state`),
                Var(`Float`, `targetValue`),
            ], 'void')`
                state.currentLine = {
                    p0: {
                        x: toFloat(${core.FRAME}), 
                        y: state.currentValue,
                    }, 
                    p1: {
                        x: toFloat(${core.FRAME}) + state.nextDurationSamp, 
                        y: targetValue,
                    }, 
                    dx: state.grainSamp
                }
                state.nextDurationSamp = 0
                state.currentLine.dy = ${linesUtils.computeSlope}(state.currentLine.p0, state.currentLine.p1) * state.grainSamp
            `,
        
            Func(ns.setNextDuration, [
                Var(ns.State, `state`),
                Var(`Float`, `durationMsec`),
            ], 'void')`
                state.nextDurationSamp = computeUnitInSamples(${core.SAMPLE_RATE}, durationMsec, 'msec')
            `,
        
            Func(ns.setGrain, [
                Var(ns.State, `state`),
                Var(`Float`, `grainMsec`),
            ], 'void')`
                state.grainSamp = computeUnitInSamples(${core.SAMPLE_RATE}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
            `,
        
            Func(ns.stopCurrentLine, [
                Var(ns.State, `state`),
            ], 'void')`
                if (state.skedId !== ${sked.ID_NULL}) {
                    ${commons.cancelWaitFrame}(state.skedId)
                    state.skedId = ${sked.ID_NULL}
                }
                if (${core.FRAME} < state.nextSampInt) {
                    ${ns.incrementTime}(state, -1 * (state.nextSamp - toFloat(${core.FRAME})))
                }
                ${ns.setNextSamp}(state, -1)
            `,
        
            Func(ns.setNextSamp, [
                Var(ns.State, `state`),
                Var(`Float`, `currentSamp`),
            ], 'void')`
                state.nextSamp = currentSamp
                state.nextSampInt = toInt(Math.round(currentSamp))
            `,
        
            Func(ns.incrementTime, [
                Var(ns.State, `state`),
                Var(`Float`, `incrementSamp`),
            ], 'void')`
                if (incrementSamp === state.currentLine.dx) {
                    state.currentValue += state.currentLine.dy
                } else {
                    state.currentValue += ${points.interpolateLin}(
                        incrementSamp,
                        {x: 0, y: 0},
                        {x: state.currentLine.dx, y: state.currentLine.dy},
                    )
                }
                ${ns.setNextSamp}(
                    state, 
                    (state.nextSamp !== -1 ? state.nextSamp: toFloat(${core.FRAME})) + incrementSamp
                )
            `,
        
            Func(ns.tick, [
                Var(ns.State, `state`),
            ], 'void')`
                state.snd0(${msg.floats}([state.currentValue]))
                if (toFloat(${core.FRAME}) >= state.currentLine.p1.x) {
                    state.currentValue = state.currentLine.p1.y
                    ${ns.stopCurrentLine}(state)
                } else {
                    ${ns.incrementTime}(state, state.currentLine.dx)
                    ${ns.scheduleNextTick}(state)
                }
            `,
        
            Func(ns.scheduleNextTick, [
                Var(ns.State, `state`),
            ], 'void')`
                state.skedId = ${commons.waitFrame}(state.nextSampInt, state.tickCallback)
            `
        ]),

    dependencies: [
        actionUtils,
        computeUnitInSamples,
        linesUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
