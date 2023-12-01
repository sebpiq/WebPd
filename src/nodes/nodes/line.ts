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

import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
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

// ------------------------------- generateDeclarations ------------------------------ //

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

const nodeCore: GlobalCodeGenerator = ({ globs }) => Sequence([

    Class(variableNames.stateClass, [
        Var('LineSegment', 'currentLine'),
        Var('Float', 'currentValue'),
        Var('Float', 'nextSamp'),
        Var('Int', 'nextSampInt'),
        Var('Float', 'grainSamp'),
        Var('Float', 'nextDurationSamp'),
        Var('SkedId', 'skedId'),
        Var('(m: Message) => void', 'snd0'),
        Var('SkedCallback', 'tickCallback'),
    ]),

    Func(variableNames.setNewLine, [
        Var(variableNames.stateClass, 'state'),
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
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'durationMsec'),
    ], 'void')`
        state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    `,

    Func(variableNames.setGrain, [
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'grainMsec'),
    ], 'void')`
        state.grainSamp = computeUnitInSamples(${globs.sampleRate}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
    `,

    Func(variableNames.stopCurrentLine, [
        Var(variableNames.stateClass, 'state'),
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
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'currentSamp'),
    ], 'void')`
        state.nextSamp = currentSamp
        state.nextSampInt = toInt(Math.round(currentSamp))
    `,

    Func(variableNames.incrementTime, [
        Var(variableNames.stateClass, 'state'),
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
        Var(variableNames.stateClass, 'state'),
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
        Var(variableNames.stateClass, 'state'),
    ], 'void')`
        state.skedId = commons_waitFrame(state.nextSampInt, state.tickCallback)
    `
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args, id }, state, snds }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, ast`{
            currentLine: {
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            },
            currentValue: ${args.initValue},
            nextSamp: -1,
            nextSampInt: -1,
            grainSamp: 0,
            nextDurationSamp: 0,
            skedId: SKED_ID_NULL,
            snd0: ${snds.$0},
            tickCallback: ${AnonFunc()``},
        }`)}

        commons_waitEngineConfigure(() => {
            ${variableNames.setGrain}(${state}, ${args.timeGrainMsec})
            ${state}.tickCallback = ${AnonFunc()`
                ${variableNames.tick}(${state})
            `}
        })
    `

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ 
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
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    initialization: initialization,
    messageReceivers: messageReceivers,
    dependencies: [
        stringMsgUtils,
        computeUnitInSamples,
        linesUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsWaitFrame,
        nodeCore
    ],
}

export { builder, nodeImplementation, NodeArguments }
