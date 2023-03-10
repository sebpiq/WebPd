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

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { stringMsgUtils } from '../nodes-shared-code/core'
import { delayBuffers } from '../nodes-shared-code/delay-buffers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

interface NodeArguments {
    delayName: string,
    maxDurationMsec: number,
}
const stateVariables = {
    delayName: 1,
    buffer: 1,
    funcSetDelayName: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : default maxDurationMsec in Pd ? 
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        delayName: assertOptionalString(args[0]) || '',
        maxDurationMsec: assertOptionalNumber(args[1]) || 100,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {},
        isPullingSignal: true,
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        return undefined
    },
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ 
    state, 
    globs,
    node: { args },
    macros: { Var, Func }
}) => `
    let ${Var(state.delayName, 'string')} = ""
    let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL

    const ${state.funcSetDelayName} = ${Func([
        Var('delayName', 'string')
    ], 'void')} => {
        if (${state.delayName}.length) {
            DELAY_BUFFERS_delete(${state.delayName})
        }
        ${state.delayName} = delayName
        if (${state.delayName}.length) {
            DELAY_BUFFERS_set(${state.delayName}, ${state.buffer})
        }
    }

    commons_waitEngineConfigure(() => {
        ${state.buffer} = buf_create(
            toInt(computeUnitInSamples(
                ${globs.sampleRate}, 
                toFloat(${args.maxDurationMsec}), 
                "msec"
            ))
        )
        if ("${args.delayName}".length) {
            ${state.funcSetDelayName}("${args.delayName}")
        }
    })
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, state }) => `
    buf_writeSample(${state.buffer}, ${ins.$0})
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': `
        if (msg_isAction(${globs.m}, 'clear')) {
            buf_clear(${state.buffer})
            return
        }
    `
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
    sharedCode: [ computeUnitInSamples, delayBuffers, stringMsgUtils ]
}

export { builder, nodeImplementation, NodeArguments }