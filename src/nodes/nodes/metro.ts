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
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../global-code/timing'
import { Class, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    rate: number
    unitAmount: number
    unit: string
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        rate: assertOptionalNumber(pdNode.args[0]) || 0,
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
    }),
}

// ------------------------------ node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('metro', [
    'setRate',
    'scheduleNextTick',
    'stop',
])

const nodeImplementation: _NodeImplementation = {
    state: ({ stateClassName }) => 
        Class(stateClassName, [
            Var('Float', 'rate', 0),
            Var('Float', 'sampleRatio', 1),
            Var('Int', 'skedId', 'SKED_ID_NULL'),
            Var('Float', 'realNextTick', -1),
            Var('MessageHandler', 'snd0', AnonFunc([Var('Message', 'm')])``),
            Var('SkedCallback', 'tickCallback', AnonFunc()``),
        ]),

    initialization: ({
        node: { args }, 
        state, 
        globs, 
        snds,
    }) => 
        ast`
            ${state}.snd0 = ${snds.$0}
            ${state}.sampleRatio = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${variableNames.setRate}(${state}, ${args.rate})
            ${state}.tickCallback = ${AnonFunc()`
                ${variableNames.scheduleNextTick}(${state})
            `}
        `,
    
    messageReceivers: ({ 
        state, 
        globs, 
    }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_getLength(m) === 1) {
                if (
                    (msg_isFloatToken(m, 0) && msg_readFloatToken(m, 0) === 0)
                    || msg_isAction(m, 'stop')
                ) {
                    ${variableNames.stop}(${state})
                    return
    
                } else if (
                    msg_isFloatToken(m, 0)
                    || msg_isBang(m)
                ) {
                    ${state}.realNextTick = toFloat(${globs.frame})
                    ${variableNames.scheduleNextTick}(${state})
                    return
                }
            }
        `,
    
        '1': coldFloatInletWithSetter(variableNames.setRate, state),
    }),

    core: ({ stateClassName }) => 
        Sequence([
            // Time units are all expressed in samples here
            Func(variableNames.setRate, [
                Var(stateClassName, 'state'),
                Var('Float', 'rate'),
            ], 'void')`
                state.rate = Math.max(rate, 0)
            `,
        
            Func(variableNames.scheduleNextTick, [
                Var(stateClassName, 'state'),
            ], 'void')`
                state.snd0(msg_bang())
                state.realNextTick = state.realNextTick + state.rate * state.sampleRatio
                state.skedId = commons_waitFrame(
                    toInt(Math.round(state.realNextTick)), 
                    state.tickCallback,
                )
            `,
        
            Func(variableNames.stop, [
                Var(stateClassName, 'state'),
            ], 'void')`
                if (state.skedId !== SKED_ID_NULL) {
                    commons_cancelWaitFrame(state.skedId)
                    state.skedId = SKED_ID_NULL
                }
                state.realNextTick = 0
            `,
        ]),

    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stringMsgUtils,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
