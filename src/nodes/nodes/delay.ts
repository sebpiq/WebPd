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
import { stdlib } from '@webpd/compiler'
import { ast, Var, Func, AnonFunc, ConstVar } from '@webpd/compiler/src/ast/declare'

interface NodeArguments { 
    delay: number,
    unitAmount: number,
    unit: string,
}
const stateVariables = {
    funcSetDelay: 1,
    funcScheduleDelay: 1,
    funcStopDelay: 1,
    delay: 1,
    scheduledBang: 1,
    sampleRatio: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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

// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ 
    state,
    snds, 
    globs,
    node: { args },
}) => 
    ast`
        ${Var('Float', state.delay, '0')}
        ${Var('Float', state.sampleRatio, '1')}
        ${Var('SkedId', state.scheduledBang, 'SKED_ID_NULL')}

        ${Func(state.funcSetDelay, [
            Var('Float', 'delay')
        ], 'void')`
            ${state.delay} = Math.max(0, delay)
        `}

        ${Func(state.funcScheduleDelay, [], 'void')`
            if (${state.scheduledBang} !== SKED_ID_NULL) {
                ${state.funcStopDelay}()
            }
            ${state.scheduledBang} = commons_waitFrame(toInt(
                Math.round(
                    toFloat(${globs.frame}) + ${state.delay} * ${state.sampleRatio})),
                () => ${snds.$0}(msg_bang())
            )
        `}

        ${Func(state.funcStopDelay, [], 'void')`
            commons_cancelWaitFrame(${state.scheduledBang})
            ${state.scheduledBang} = SKED_ID_NULL
        `}

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetDelay}(${args.delay})
        })
    `

// ------------------------------ generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ state, globs }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_getLength(m) === 1) {
            if (msg_isStringToken(m, 0)) {
                ${ConstVar('string', 'action', 'msg_readStringToken(m, 0)')}
                if (action === 'bang' || action === 'start') {
                    ${state.funcScheduleDelay}()
                    return
                } else if (action === 'stop') {
                    ${state.funcStopDelay}()
                    return
                }
                
            } else if (msg_isFloatToken(m, 0)) {
                ${state.funcSetDelay}(msg_readFloatToken(m, 0))
                ${state.funcScheduleDelay}()
                return 
            }
        
        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'tempo'
        ) {
            ${state.sampleRatio} = computeUnitInSamples(
                ${globs.sampleRate}, 
                msg_readFloatToken(m, 1), 
                msg_readStringToken(m, 2)
            )
            return
        }
    `,
    
    '1': coldFloatInletWithSetter(state.funcSetDelay)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    stateVariables,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsWaitFrame,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}