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
import { actionUtils } from '../global-code/core'
import { linesUtils } from '../global-code/lines'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Func, Var, ast, ConstVar, AnonFunc, Class, Sequence } from '@webpd/compiler'

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
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'line_t',
    },

    state: ({ node: { args }, ns }, { linesUtils }) => 
        Class(ns.State, [
            Var(linesUtils.LineSegment, `currentLine`, ns.defaultLine),
            Var(`Float`, `currentValue`, args.initValue),
            Var(`Float`, `nextDurationSamp`, 0),
        ]),

    messageReceivers: ({ ns, state }, { actionUtils, msg }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (
                ${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])
                || ${msg.isMatching}(m, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}])
            ) {
                switch (${msg.getLength}(m)) {
                    case 2:
                        ${ns.setNextDuration}(${state}, ${msg.readFloatToken}(m, 1))
                    case 1:
                        ${ns.setNewLine}(${state}, ${msg.readFloatToken}(m, 0))
                }
                return
    
            } else if (${actionUtils.isAction}(m, 'stop')) {
                ${ns.stop}(${state})
                return
    
            }
        `,
    
        '1': coldFloatInletWithSetter(ns.setNextDuration, state, msg),
    }),

    dsp: ({ outs, state }, { core }) => ast`
        ${outs.$0} = ${state}.currentValue
        if (toFloat(${core.FRAME}) < ${state}.currentLine.p1.x) {
            ${state}.currentValue += ${state}.currentLine.dy
            if (toFloat(${core.FRAME} + 1) >= ${state}.currentLine.p1.x) {
                ${state}.currentValue = ${state}.currentLine.p1.y
            }
        }
    `,

    core: ({ ns }, { linesUtils, core }) => 
        Sequence([
            ConstVar(linesUtils.LineSegment, ns.defaultLine, `{
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            }`),
        
            Func(ns.setNewLine, [
                Var(ns.State, `state`),
                Var(`Float`, `targetValue`),
            ], 'void')`
                ${ConstVar(`Float`, `startFrame`, `toFloat(${core.FRAME})`)}
                ${ConstVar(`Float`, `endFrame`, `toFloat(${core.FRAME}) + state.nextDurationSamp`)}
                if (endFrame === toFloat(${core.FRAME})) {
                    state.currentLine = ${ns.defaultLine}
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
                    state.currentLine.dy = ${linesUtils.computeSlope}(state.currentLine.p0, state.currentLine.p1)
                    state.nextDurationSamp = 0
                }
            `,
        
            Func(ns.setNextDuration, [
                Var(ns.State, `state`),
                Var(`Float`, `durationMsec`),
            ], 'void')`
                state.nextDurationSamp = computeUnitInSamples(${core.SAMPLE_RATE}, durationMsec, 'msec')
            `,
        
            Func(ns.stop, [
                Var(ns.State, `state`),
            ], 'void')`
                state.currentLine.p1.x = -1
                state.currentLine.p1.y = state.currentValue
            `
        ]),


    dependencies: [
        actionUtils, 
        computeUnitInSamples, 
        linesUtils, 
    ],
}

export { builder, nodeImplementation, NodeArguments }
