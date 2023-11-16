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
import { Func, Var, ast, ConstVar, AnonFunc } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {
    initValue: number
}
const stateVariables = {
    // Current value used only between 2 lines
    currentValue: 1,
    currentLine: 1,
    defaultLine: 1,
    nextDurationSamp: 1,
    funcSetNewLine: 1,
    funcSetNextDuration: 1,
    funcStopCurrentLine: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    globs,
    state,
    node: { args },
}) => 
    ast`
        ${ConstVar('LineSegment', state.defaultLine, `{
            p0: {x: -1, y: 0},
            p1: {x: -1, y: 0},
            dx: 1,
            dy: 0,
        }`)}
        ${Var('LineSegment', state.currentLine, state.defaultLine)}
        ${Var('Float', state.currentValue, args.initValue)}
        ${Var('Float', state.nextDurationSamp, 0)}

        ${Func(state.funcSetNewLine, [
            Var('Float', 'targetValue'),
        ], 'void')`
            ${ConstVar('Float', 'startFrame', `toFloat(${globs.frame})`)}
            ${ConstVar('Float', 'endFrame', `toFloat(${globs.frame}) + ${state.nextDurationSamp}`)}
            if (endFrame === toFloat(${globs.frame})) {
                ${state.currentLine} = ${state.defaultLine}
                ${state.currentValue} = targetValue
                ${state.nextDurationSamp} = 0
            } else {
                ${state.currentLine} = {
                    p0: {
                        x: startFrame, 
                        y: ${state.currentValue},
                    }, 
                    p1: {
                        x: endFrame, 
                        y: targetValue,
                    }, 
                    dx: 1,
                    dy: 0,
                }
                ${state.currentLine}.dy = computeSlope(${state.currentLine}.p0, ${state.currentLine}.p1)
                ${state.nextDurationSamp} = 0
            }
        `}

        ${Func(state.funcSetNextDuration, [
            Var('Float', 'durationMsec'),
        ], 'void')`
            ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
        `}

        ${Func(state.funcStopCurrentLine, [], 'void')`
            ${state.currentLine}.p1.x = -1
            ${state.currentLine}.p1.y = ${state.currentValue}
        `}
    `

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ globs, state }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (
            msg_isMatching(m, [MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        ) {
            switch (msg_getLength(m)) {
                case 2:
                    ${state.funcSetNextDuration}(msg_readFloatToken(m, 1))
                case 1:
                    ${state.funcSetNewLine}(msg_readFloatToken(m, 0))
            }
            return

        } else if (msg_isAction(m, 'stop')) {
            ${state.funcStopCurrentLine}()
            return

        }
    `,

    '1': coldFloatInletWithSetter(state.funcSetNextDuration),
})

// ------------------------------- generateLoop ------------------------------ //
const generateLoop: _NodeImplementation['generateLoop'] = ({ outs, state, globs }) => ast`
    ${outs.$0} = ${state.currentValue}
    if (toFloat(${globs.frame}) < ${state.currentLine}.p1.x) {
        ${state.currentValue} += ${state.currentLine}.dy
        if (toFloat(${globs.frame} + 1) >= ${state.currentLine}.p1.x) {
            ${state.currentValue} = ${state.currentLine}.p1.y
        }
    }
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    generateLoop,
    stateVariables,
    dependencies: [stringMsgUtils, computeUnitInSamples, linesUtils]
}

export { builder, nodeImplementation, NodeArguments }
