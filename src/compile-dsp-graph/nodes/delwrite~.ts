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
import { assertOptionalString, assertOptionalNumber } from '../nodes-shared-code/validation'
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