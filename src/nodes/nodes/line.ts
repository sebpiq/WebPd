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

import { NodeImplementation } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { stringMsgUtils } from '../global-code/core'
import { linesUtils } from '../global-code/lines'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { coreCode } from '@webpd/compiler'

interface NodeArguments {
    initValue: number
    timeGrainMsec: number
}
const stateVariables = {
    currentValue: 1,
    nextSamp: 1,
    nextSampInt: 1,
    currentLine: 1,
    nextDurationSamp: 1,
    grainSamp: 1,
    skedId: 1,
    funcSetNewLine: 1,
    funcSetNextDuration: 1,
    funcSetGrain: 1,
    funcStopCurrentLine: 1,
    funcSetNextSamp: 1,
    funcIncrementTime: 1,
    funcScheduleNextTick: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    globs,
    state,
    snds,
    node: { args },
    macros: { Var, Func },
}) => `
    let ${Var(state.currentLine, 'LineSegment')} = {
        p0: {x: -1, y: 0},
        p1: {x: -1, y: 0},
        dx: 1,
        dy: 0,
    }
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
    let ${Var(state.nextSamp, 'Float')} = -1
    let ${Var(state.nextSampInt, 'Int')} = -1
    let ${Var(state.grainSamp, 'Float')} = 0
    let ${Var(state.nextDurationSamp, 'Float')} = 0
    let ${Var(state.skedId, 'SkedId')} = SKED_ID_NULL

    function ${state.funcSetNewLine} ${Func([
        Var('targetValue', 'Float'),
    ], 'void')} {
        ${state.currentLine} = {
            p0: {
                x: toFloat(${globs.frame}), 
                y: ${state.currentValue},
            }, 
            p1: {
                x: toFloat(${globs.frame}) + ${state.nextDurationSamp}, 
                y: targetValue,
            }, 
            dx: ${state.grainSamp}
        }
        ${state.nextDurationSamp} = 0
        ${state.currentLine}.dy = computeSlope(${state.currentLine}.p0, ${state.currentLine}.p1) * ${state.grainSamp}
    }

    function ${state.funcSetNextDuration} ${Func([
        Var('durationMsec', 'Float'),
    ], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcSetGrain} ${Func([
        Var('grainMsec', 'Float'),
    ], 'void')} {
        ${state.grainSamp} = computeUnitInSamples(${globs.sampleRate}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
    }

    function ${state.funcStopCurrentLine} ${Func([], 'void')} {
        if (${state.skedId} !== SKED_ID_NULL) {
            commons_cancelWaitFrame(${state.skedId})
            ${state.skedId} = SKED_ID_NULL
        }
        if (${globs.frame} < ${state.nextSampInt}) {
            ${state.funcIncrementTime}(-1 * (${state.nextSamp} - toFloat(${globs.frame})))
        }
        ${state.funcSetNextSamp}(-1)
    }

    function ${state.funcSetNextSamp} ${Func([
        Var('currentSamp', 'Float'),
    ], 'void')} {
        ${state.nextSamp} = currentSamp
        ${state.nextSampInt} = toInt(Math.round(currentSamp))
    }

    function ${state.funcIncrementTime} ${Func([
        Var('incrementSamp', 'Float'),
    ], 'void')} {
        if (incrementSamp === ${state.currentLine}.dx) {
            ${state.currentValue} += ${state.currentLine}.dy
        } else {
            ${state.currentValue} += interpolateLin(
                incrementSamp,
                {x: 0, y: 0},
                {x: ${state.currentLine}.dx, y: ${state.currentLine}.dy},
            )
        }
        ${state.funcSetNextSamp}((${state.nextSamp} !== -1 ? ${state.nextSamp}: toFloat(${globs.frame})) + incrementSamp)
    }

    function ${state.funcScheduleNextTick} ${Func([], 'void')} {
        ${state.skedId} = commons_waitFrame(${state.nextSampInt}, () => {
            ${snds.$0}(msg_floats([${state.currentValue}]))
            if (toFloat(${globs.frame}) >= ${state.currentLine}.p1.x) {
                ${state.currentValue} = ${state.currentLine}.p1.y
                ${state.funcStopCurrentLine}()
            } else {
                ${state.funcIncrementTime}(${state.currentLine}.dx)
                ${state.funcScheduleNextTick}()
            }
        })
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetGrain}(${args.timeGrainMsec})
    })
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state, macros: { Var } }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        ${state.funcStopCurrentLine}()
        switch (msg_getLength(${globs.m})) {
            case 3:
                ${state.funcSetGrain}(msg_readFloatToken(${globs.m}, 2))
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                const ${Var('targetValue', 'Float')} = msg_readFloatToken(${globs.m}, 0)
                if (${state.nextDurationSamp} === 0) {
                    ${state.currentValue} = targetValue
                    ${snds.$0}(msg_floats([targetValue]))
                } else {
                    ${snds.$0}(msg_floats([${state.currentValue}]))
                    ${state.funcSetNewLine}(targetValue)
                    ${state.funcIncrementTime}(${state.currentLine}.dx)
                    ${state.funcScheduleNextTick}()
                }
                
        }
        return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStopCurrentLine}()
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcStopCurrentLine}()
        ${state.currentValue} = msg_readFloatToken(${globs.m}, 1)
        return
    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetGrain),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare,
    messages,
    stateVariables,
    globalCode: [
        stringMsgUtils,
        computeUnitInSamples,
        linesUtils,
        coreCode.commonsWaitEngineConfigure,
        coreCode.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
