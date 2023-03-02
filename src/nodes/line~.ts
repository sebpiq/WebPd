/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { stringMsgUtils } from '../nodes-shared-code/core'
import { linesUtils } from '../nodes-shared-code/lines'
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

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

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    globs,
    state,
    node: { args },
    macros: { Var, Func },
}) => `
    const ${Var(state.defaultLine, 'LineSegment')} = {
        p0: {x: -1, y: 0},
        p1: {x: -1, y: 0},
        dx: 1,
        dy: 0,
    }
    let ${Var(state.currentLine, 'LineSegment')} = ${state.defaultLine}
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
    let ${Var(state.nextDurationSamp, 'Float')} = 0

    function ${state.funcSetNewLine} ${Func([
        Var('targetValue', 'Float'),
    ], 'void')} {
        const ${Var('startFrame', 'Float')} = toFloat(${globs.frame})
        const ${Var('endFrame', 'Float')} = toFloat(${globs.frame}) + ${state.nextDurationSamp}
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
    }

    function ${state.funcSetNextDuration} ${Func([
        Var('durationMsec', 'Float'),
    ], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcStopCurrentLine} ${Func([], 'void')} {
        ${state.currentLine}.p1.x = -1
        ${state.currentLine}.p1.y = ${state.currentValue}
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ globs, state, macros: { Var } }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        switch (msg_getLength(${globs.m})) {
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                ${state.funcSetNewLine}(msg_readFloatToken(${globs.m}, 0))
        }
        return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStopCurrentLine}()
        return

    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
})

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ outs, state, globs }) => `
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
    declare,
    messages,
    loop,
    stateVariables,
    sharedCode: [stringMsgUtils, computeUnitInSamples, ...linesUtils]
}

export { builder, nodeImplementation, NodeArguments }
