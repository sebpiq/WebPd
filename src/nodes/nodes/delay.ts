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
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, Sequence, stdlib } from '@webpd/compiler'
import { ast, Var, Func, AnonFunc, ConstVar } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments { 
    delay: number,
    unitAmount: number,
    unit: string,
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        delay: assertOptionalNumber(pdNode.args[0]) || 0,
        unitAmount: assertOptionalNumber(pdNode.args[1]) || 1,
        unit: assertOptionalString(pdNode.args[2]) || 'msec',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true
    }),
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('delay', [
    'setDelay',
    'scheduleDelay',
    'stop',
])

const nodeImplementation: _NodeImplementation = {
    state: ({ stateClassName }) => 
        Class(stateClassName, [
            Var('Float', 'delay', 0),
            Var('Float', 'sampleRatio', 1),
            Var('SkedId', 'scheduledBang', 'SKED_ID_NULL'),
        ]),

    initialization: ({ node: { args }, state, globs }) => ast`
        ${state}.sampleRatio = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
        ${variableNames.setDelay}(${state}, ${args.delay})
    `,

    messageReceivers: ({ state, globs, snds }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_getLength(m) === 1) {
                if (msg_isStringToken(m, 0)) {
                    ${ConstVar('string', 'action', 'msg_readStringToken(m, 0)')}
                    if (action === 'bang' || action === 'start') {
                        ${variableNames.scheduleDelay}(
                            ${state}, 
                            () => ${snds.$0}(msg_bang()),
                            ${globs.frame},
                        )
                        return
                    } else if (action === 'stop') {
                        ${variableNames.stop}(${state})
                        return
                    }
                    
                } else if (msg_isFloatToken(m, 0)) {
                    ${variableNames.setDelay}(${state}, msg_readFloatToken(m, 0))
                    ${variableNames.scheduleDelay}(
                        ${state},
                        () => ${snds.$0}(msg_bang()),
                        ${globs.frame},
                    )
                    return 
                }
            
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'tempo'
            ) {
                ${state}.sampleRatio = computeUnitInSamples(
                    ${globs.sampleRate}, 
                    msg_readFloatToken(m, 1), 
                    msg_readStringToken(m, 2)
                )
                return
            }
        `,
        
        '1': coldFloatInletWithSetter(variableNames.setDelay, state)
    }),

    core: ({ stateClassName }) => 
        Sequence([
            Func(variableNames.setDelay, [
                Var(stateClassName, 'state'),
                Var('Float', 'delay'),
            ], 'void')`
                state.delay = Math.max(0, delay)
            `,

            Func(variableNames.scheduleDelay, [
                Var(stateClassName, 'state'),
                Var('SkedCallback', 'callback'),
                Var('Int', 'currentFrame'),
            ], 'void')`
                if (state.scheduledBang !== SKED_ID_NULL) {
                    ${variableNames.stop}(state)
                }
                state.scheduledBang = commons_waitFrame(toInt(
                    Math.round(
                        toFloat(currentFrame) + state.delay * state.sampleRatio)),
                    callback
                )
            `,

            Func(variableNames.stop, [
                Var(stateClassName, 'state'),
            ], 'void')`
                commons_cancelWaitFrame(state.scheduledBang)
                state.scheduledBang = SKED_ID_NULL
            `
        ]),

    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}