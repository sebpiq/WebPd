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
import { stringMsgUtils } from '../global-code/core'
import { linesUtils } from '../global-code/lines'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

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
const variableNames = generateVariableNamesNodeType('line', [
    'setNewLine',
    'setNextDuration',
    'setGrain',
    'stopCurrentLine',
    'setNextSamp',
    'incrementTime',
    'tick',
    'scheduleNextTick',
])

const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, stateClassName }) => 
        Class(stateClassName, [
            Var('LineSegment', 'currentLine', `{
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            }`),
            Var('Float', 'currentValue', args.initValue),
            Var('Float', 'nextSamp', -1),
            Var('Int', 'nextSampInt', -1),
            Var('Float', 'grainSamp', 0),
            Var('Float', 'nextDurationSamp', 0),
            Var('SkedId', 'skedId', 'SKED_ID_NULL'),
            Var('MessageHandler', 'snd0', ast`${AnonFunc([Var('Message', 'm')])``}`),
            Var('SkedCallback', 'tickCallback', ast`${AnonFunc()``}`),
        ]),
    
    initialization: ({ node: { args }, state, snds }) => 
        ast`
            ${variableNames.setGrain}(${state}, ${args.timeGrainMsec})
            ${state}.snd0 = ${snds.$0}
            ${state}.tickCallback = ${AnonFunc()`
                ${variableNames.tick}(${state})
            `}
        `,
    
    messageReceivers: ({ 
        snds, 
        state,
    }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isMatching(m, [MSG_FLOAT_TOKEN])
                || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
                || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
            ) {
                ${variableNames.stopCurrentLine}(${state})
                switch (msg_getLength(m)) {
                    case 3:
                        ${variableNames.setGrain}(${state}, msg_readFloatToken(m, 2))
                    case 2:
                        ${variableNames.setNextDuration}(${state}, msg_readFloatToken(m, 1))
                    case 1:
                        ${ConstVar('Float', 'targetValue', 'msg_readFloatToken(m, 0)')}
                        if (${state}.nextDurationSamp === 0) {
                            ${state}.currentValue = targetValue
                            ${snds.$0}(msg_floats([targetValue]))
                        } else {
                            ${snds.$0}(msg_floats([${state}.currentValue]))
                            ${variableNames.setNewLine}(${state}, targetValue)
                            ${variableNames.incrementTime}(${state}, ${state}.currentLine.dx)
                            ${variableNames.scheduleNextTick}(${state})
                        }
                        
                }
                return
    
            } else if (msg_isAction(m, 'stop')) {
                ${variableNames.stopCurrentLine}(${state})
                return
    
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNames.stopCurrentLine}(${state})
                ${state}.currentValue = msg_readFloatToken(m, 1)
                return
            }
        `,
    
        '1': coldFloatInletWithSetter(variableNames.setNextDuration, state),
        '2': coldFloatInletWithSetter(variableNames.setGrain, state),
    }),

    core: ({ globs, stateClassName }) => 
        Sequence([
            Func(variableNames.setNewLine, [
                Var(stateClassName, 'state'),
                Var('Float', 'targetValue'),
            ], 'void')`
                state.currentLine = {
                    p0: {
                        x: toFloat(${globs.frame}), 
                        y: state.currentValue,
                    }, 
                    p1: {
                        x: toFloat(${globs.frame}) + state.nextDurationSamp, 
                        y: targetValue,
                    }, 
                    dx: state.grainSamp
                }
                state.nextDurationSamp = 0
                state.currentLine.dy = computeSlope(state.currentLine.p0, state.currentLine.p1) * state.grainSamp
            `,
        
            Func(variableNames.setNextDuration, [
                Var(stateClassName, 'state'),
                Var('Float', 'durationMsec'),
            ], 'void')`
                state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
            `,
        
            Func(variableNames.setGrain, [
                Var(stateClassName, 'state'),
                Var('Float', 'grainMsec'),
            ], 'void')`
                state.grainSamp = computeUnitInSamples(${globs.sampleRate}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
            `,
        
            Func(variableNames.stopCurrentLine, [
                Var(stateClassName, 'state'),
            ], 'void')`
                if (state.skedId !== SKED_ID_NULL) {
                    commons_cancelWaitFrame(state.skedId)
                    state.skedId = SKED_ID_NULL
                }
                if (${globs.frame} < state.nextSampInt) {
                    ${variableNames.incrementTime}(state, -1 * (state.nextSamp - toFloat(${globs.frame})))
                }
                ${variableNames.setNextSamp}(state, -1)
            `,
        
            Func(variableNames.setNextSamp, [
                Var(stateClassName, 'state'),
                Var('Float', 'currentSamp'),
            ], 'void')`
                state.nextSamp = currentSamp
                state.nextSampInt = toInt(Math.round(currentSamp))
            `,
        
            Func(variableNames.incrementTime, [
                Var(stateClassName, 'state'),
                Var('Float', 'incrementSamp'),
            ], 'void')`
                if (incrementSamp === state.currentLine.dx) {
                    state.currentValue += state.currentLine.dy
                } else {
                    state.currentValue += interpolateLin(
                        incrementSamp,
                        {x: 0, y: 0},
                        {x: state.currentLine.dx, y: state.currentLine.dy},
                    )
                }
                ${variableNames.setNextSamp}(
                    state, 
                    (state.nextSamp !== -1 ? state.nextSamp: toFloat(${globs.frame})) + incrementSamp
                )
            `,
        
            Func(variableNames.tick, [
                Var(stateClassName, 'state'),
            ], 'void')`
                state.snd0(msg_floats([state.currentValue]))
                if (toFloat(${globs.frame}) >= state.currentLine.p1.x) {
                    state.currentValue = state.currentLine.p1.y
                    ${variableNames.stopCurrentLine}(state)
                } else {
                    ${variableNames.incrementTime}(state, state.currentLine.dx)
                    ${variableNames.scheduleNextTick}(state)
                }
            `,
        
            Func(variableNames.scheduleNextTick, [
                Var(stateClassName, 'state'),
            ], 'void')`
                state.skedId = commons_waitFrame(state.nextSampInt, state.tickCallback)
            `
        ]),

    dependencies: [
        stringMsgUtils,
        computeUnitInSamples,
        linesUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
