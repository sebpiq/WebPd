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

interface NodeArguments {}
const stateVariables = {
    points: 1,
    lineSegments: 1,
    currentValue: 1,
    nextDurationSamp: 1,
    nextDelaySamp: 1,
    funcSetNewLine: 1,
    funcSetNextDuration: 1,
    funcSetNextDelay: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ globs, state, macros: { Var, Func }}) => `
    let ${Var(state.points, 'Array<Point>')} = []
    let ${Var(state.lineSegments, 'Array<LineSegment>')} = []
    let ${Var(state.currentValue, 'Float')} = 0
    let ${Var(state.nextDurationSamp, 'Float')} = 0
    let ${Var(state.nextDelaySamp, 'Float')} = 0

    function ${state.funcSetNewLine} ${Func([
        Var('targetValue', 'Float'),
    ], 'void')} {
        ${state.points} = removePointsBeforeFrame(${state.points}, toFloat(${globs.frame}))
        const ${Var('startFrame', 'Float')} = toFloat(${globs.frame}) + ${state.nextDelaySamp}
        const ${Var('endFrame', 'Float')} = startFrame + ${state.nextDurationSamp}
        if (endFrame === toFloat(${globs.frame})) {
            ${state.currentValue} = targetValue
            ${state.lineSegments} = []
        } else {
            ${state.points} = insertNewLinePoints(
                ${state.points}, 
                {x: startFrame, y: ${state.currentValue}},
                {x: endFrame, y: targetValue}
            )
            ${state.lineSegments} = computeLineSegments(
                computeFrameAjustedPoints(${state.points}))
        }
        ${state.nextDurationSamp} = 0
        ${state.nextDelaySamp} = 0
    }

    function ${state.funcSetNextDuration} ${Func([
        Var('durationMsec', 'Float'),
    ], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcSetNextDelay} ${Func([
        Var('delayMsec', 'Float'),
    ], 'void')} {
        ${state.nextDelaySamp} = computeUnitInSamples(${globs.sampleRate}, delayMsec, 'msec')
    }
`

// ------------------------------- generateLoop ------------------------------ //
const generateLoop: _NodeImplementation['generateLoop'] = ({ outs, state, globs }) => `
    if (${state.lineSegments}.length) {
        if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p0.x) {

        // This should come first to handle vertical lines
        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p1.y
            ${state.lineSegments}.shift()

        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p0.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p0.y

        } else if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} += ${state.lineSegments}[0].dy

        }
    }
    ${outs.$0} = ${state.currentValue}
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        switch (msg_getLength(${globs.m})) {
            case 3:
                ${state.funcSetNextDelay}(msg_readFloatToken(${globs.m}, 2))
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                ${state.funcSetNewLine}(msg_readFloatToken(${globs.m}, 0))
        }
        return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.points} = []
        ${state.lineSegments} = []
        return
    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetNextDelay),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateLoop,
    stateVariables,
    generateMessageReceivers,
    generateDeclarations,
    dependencies: [linesUtils, computeUnitInSamples, stringMsgUtils]
}

export { builder, nodeImplementation, NodeArguments }