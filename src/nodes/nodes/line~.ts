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
import { Func, Var, ast, ConstVar, AnonFunc, Class, Sequence } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    initValue: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('line_t', [
    'defaultLine',
    'setNewLine',
    'setNextDuration',
    'stop',
])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: ({ node: { args } }) => 
        Var(variableNames.stateClass, '', `{
            currentLine: ${variableNames.defaultLine},
            currentValue: ${args.initValue},
            nextDurationSamp: 0,
        }`),

    messageReceivers: ({ state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isMatching(m, [MSG_FLOAT_TOKEN])
                || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
            ) {
                switch (msg_getLength(m)) {
                    case 2:
                        ${variableNames.setNextDuration}(${state}, msg_readFloatToken(m, 1))
                    case 1:
                        ${variableNames.setNewLine}(${state}, msg_readFloatToken(m, 0))
                }
                return
    
            } else if (msg_isAction(m, 'stop')) {
                ${variableNames.stop}(${state})
                return
    
            }
        `,
    
        '1': coldFloatInletWithSetter(variableNames.setNextDuration, state),
    }),

    loop: ({ outs, state, globs }) => ast`
        ${outs.$0} = ${state}.currentValue
        if (toFloat(${globs.frame}) < ${state}.currentLine.p1.x) {
            ${state}.currentValue += ${state}.currentLine.dy
            if (toFloat(${globs.frame} + 1) >= ${state}.currentLine.p1.x) {
                ${state}.currentValue = ${state}.currentLine.p1.y
            }
        }
    `,

    dependencies: [
        stringMsgUtils, 
        computeUnitInSamples, 
        linesUtils, 
        ({ globs }) => Sequence([
            Class(variableNames.stateClass, [
                Var('LineSegment', 'currentLine'),
                Var('Float', 'currentValue'),
                Var('Float', 'nextDurationSamp'),
            ]),
        
            ConstVar('LineSegment', variableNames.defaultLine, `{
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            }`),
        
            Func(variableNames.setNewLine, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'targetValue'),
            ], 'void')`
                ${ConstVar('Float', 'startFrame', `toFloat(${globs.frame})`)}
                ${ConstVar('Float', 'endFrame', `toFloat(${globs.frame}) + state.nextDurationSamp`)}
                if (endFrame === toFloat(${globs.frame})) {
                    state.currentLine = ${variableNames.defaultLine}
                    state.currentValue = targetValue
                    state.nextDurationSamp = 0
                } else {
                    state.currentLine = {
                        p0: {
                            x: startFrame, 
                            y: state.currentValue,
                        }, 
                        p1: {
                            x: endFrame, 
                            y: targetValue,
                        }, 
                        dx: 1,
                        dy: 0,
                    }
                    state.currentLine.dy = computeSlope(state.currentLine.p0, state.currentLine.p1)
                    state.nextDurationSamp = 0
                }
            `,
        
            Func(variableNames.setNextDuration, [
                Var(variableNames.stateClass, 'state'),
                Var('Float', 'durationMsec'),
            ], 'void')`
                state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
            `,
        
            Func(variableNames.stop, [
                Var(variableNames.stateClass, 'state'),
            ], 'void')`
                state.currentLine.p1.x = -1
                state.currentLine.p1.y = state.currentValue
            `
        ])        
    ],
}

export { builder, nodeImplementation, NodeArguments }
