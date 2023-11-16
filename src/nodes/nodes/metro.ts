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
import { stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    rate: number
    unitAmount: number
    unit: string
}
const stateVariables = {
    rate: 1,
    sampleRatio: 1,
    skedId: 1,
    realNextTick: 1,
    funcSetRate: 1,
    funcScheduleNextTick: 1,
    funcStop: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    state,
    globs,
    snds,
    node: { args },
}) =>
    // Time units are all expressed in samples here
    ast`
        ${Var('Float', state.rate, '0')}
        ${Var('Float', state.sampleRatio, '1')}
        ${Var('Int', state.skedId, 'SKED_ID_NULL')}
        ${Var('Float', state.realNextTick, '-1')}

        ${Func(state.funcSetRate, [
            Var('Float', 'rate')
        ], 'void')`
            ${state.rate} = Math.max(rate, 0)
        `}

        ${Func(state.funcScheduleNextTick, [], 'void')`
            ${snds.$0}(msg_bang())
            ${state.realNextTick} = ${state.realNextTick} + ${state.rate} * ${state.sampleRatio}
            ${state.skedId} = commons_waitFrame(toInt(Math.round(${state.realNextTick})), () => {
                ${state.funcScheduleNextTick}()
            })
        `}

        ${Func(state.funcStop, [], 'void')`
            if (${state.skedId} !== SKED_ID_NULL) {
                commons_cancelWaitFrame(${state.skedId})
                ${state.skedId} = SKED_ID_NULL
            }
            ${state.realNextTick} = 0
        `}

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetRate}(${args.rate})
        })
    `

// ------------------------------ generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs, snds }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
    if (msg_getLength(m) === 1) {
        if (
            (msg_isFloatToken(m, 0) && msg_readFloatToken(m, 0) === 0)
            || msg_isAction(m, 'stop')
        ) {
            ${state.funcStop}()
            return

        } else if (
            msg_isFloatToken(m, 0)
            || msg_isBang(m)
        ) {
            ${state.realNextTick} = toFloat(${globs.frame})
            ${state.funcScheduleNextTick}()
            return
        }
    }
    `,

    '1': coldFloatInletWithSetter(state.funcSetRate),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    stateVariables,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stringMsgUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
