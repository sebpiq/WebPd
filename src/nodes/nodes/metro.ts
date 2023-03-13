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
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils, stringMsgUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

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

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    globs,
    snds,
    node: { args },
    macros: { Func, Var },
}) =>
    // Time units are all expressed in samples here
    `
        let ${Var(state.rate, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.skedId, 'Int')} = SKED_ID_NULL
        let ${Var(state.realNextTick, 'Float')} = -1

        function ${state.funcSetRate} ${Func([
            Var('rate', 'Float')
        ], 'void')} {
            ${state.rate} = Math.max(rate, 0)
        }

        function ${state.funcScheduleNextTick} ${Func([], 'void')} {
            ${snds.$0}(msg_bang())
            ${state.realNextTick} = ${state.realNextTick} + ${state.rate} * ${state.sampleRatio}
            ${state.skedId} = commons_waitFrame(toInt(Math.round(${state.realNextTick})), () => {
                ${state.funcScheduleNextTick}()
            })
        }

        function ${state.funcStop} ${Func([], 'void')} {
            if (${state.skedId} !== SKED_ID_NULL) {
                commons_cancelWaitFrame(${state.skedId})
                ${state.skedId} = SKED_ID_NULL
            }
            ${state.realNextTick} = 0
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetRate}(${args.rate})
        })
    `

// ------------------------------ messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs, snds }) => ({
    '0': `
    if (msg_getLength(${globs.m}) === 1) {
        if (
            (msg_isFloatToken(${globs.m}, 0) && msg_readFloatToken(${globs.m}, 0) === 0)
            || msg_isAction(${globs.m}, 'stop')
        ) {
            ${state.funcStop}()
            return

        } else if (
            msg_isFloatToken(${globs.m}, 0)
            || msg_isBang(${globs.m})
        ) {
            ${state.realNextTick} = toFloat(${globs.frame})
            ${state.funcScheduleNextTick}()
            return
        }
    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetRate),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare,
    messages,
    stateVariables,
    sharedCode: [ computeUnitInSamples, bangUtils, stringMsgUtils ],
}

export { builder, nodeImplementation, NodeArguments }
