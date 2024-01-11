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
import { stringMsgUtils } from '../global-code/core'
import { linesUtils } from '../global-code/lines'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { AnonFunc, Class, ConstVar, Func, Sequence, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('vline_t', [
    'setNewLine',
    'setNextDuration',
    'setNextDelay',
])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: () => 
        Var(variableNames.stateClass, '', `{
            points: [],
            lineSegments: [],
            currentValue: 0,
            nextDurationSamp: 0,
            nextDelaySamp: 0,
        }`),

    loop: ({ outs, state, globs }) => ast`
        if (${state}.lineSegments.length) {
            if (toFloat(${globs.frame}) < ${state}.lineSegments[0].p0.x) {

            // This should come first to handle vertical lines
            } else if (toFloat(${globs.frame}) === ${state}.lineSegments[0].p1.x) {
                ${state}.currentValue = ${state}.lineSegments[0].p1.y
                ${state}.lineSegments.shift()

            } else if (toFloat(${globs.frame}) === ${state}.lineSegments[0].p0.x) {
                ${state}.currentValue = ${state}.lineSegments[0].p0.y

            } else if (toFloat(${globs.frame}) < ${state}.lineSegments[0].p1.x) {
                ${state}.currentValue += ${state}.lineSegments[0].dy

            }
        }
        ${outs.$0} = ${state}.currentValue
    `,

    messageReceivers: ({ state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
        if (
            msg_isMatching(m, [MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        ) {
            switch (msg_getLength(m)) {
                case 3:
                    ${variableNames.setNextDelay}(${state}, msg_readFloatToken(m, 2))
                case 2:
                    ${variableNames.setNextDuration}(${state}, msg_readFloatToken(m, 1))
                case 1:
                    ${variableNames.setNewLine}(${state}, msg_readFloatToken(m, 0))
            }
            return
    
        } else if (msg_isAction(m, 'stop')) {
            ${state}.points = []
            ${state}.lineSegments = []
            return
        }
        `,
    
        '1': coldFloatInletWithSetter(variableNames.setNextDuration, state),
        '2': coldFloatInletWithSetter(variableNames.setNextDelay, state),
    }),

    dependencies: [
        linesUtils, 
        computeUnitInSamples, 
        stringMsgUtils,
        ({ globs }) => Sequence([
            Class(variableNames.stateClass, [
                Var('Array<Point>', 'points'),
                Var('Array<LineSegment>', 'lineSegments'),
                Var('Float', 'currentValue'),
                Var('Float', 'nextDurationSamp'),
                Var('Float', 'nextDelaySamp'),
            ]),
        
            Func(variableNames.setNewLine, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'targetValue'),
            ], 'void')`
                state.points = removePointsBeforeFrame(state.points, toFloat(${globs.frame}))
                ${ConstVar('Float', 'startFrame', `toFloat(${globs.frame}) + state.nextDelaySamp`)}
                ${ConstVar('Float', 'endFrame', `startFrame + state.nextDurationSamp`)}
                if (endFrame === toFloat(${globs.frame})) {
                    state.currentValue = targetValue
                    state.lineSegments = []
                } else {
                    state.points = insertNewLinePoints(
                        state.points, 
                        {x: startFrame, y: state.currentValue},
                        {x: endFrame, y: targetValue}
                    )
                    state.lineSegments = computeLineSegments(
                        computeFrameAjustedPoints(state.points))
                }
                state.nextDurationSamp = 0
                state.nextDelaySamp = 0
            `,
        
            Func(variableNames.setNextDuration, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'durationMsec'),
            ], 'void')`
                state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
            `,
        
            Func(variableNames.setNextDelay, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'delayMsec'),
            ], 'void')`
                state.nextDelaySamp = computeUnitInSamples(${globs.sampleRate}, delayMsec, 'msec')
            `,
        ]),
    ]
}

export { builder, nodeImplementation, NodeArguments }