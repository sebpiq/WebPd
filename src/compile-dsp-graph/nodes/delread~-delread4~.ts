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

import { DspGraph } from '@webpd/compiler-js'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalString, assertOptionalNumber } from '../nodes-shared-code/validation'
import { delayBuffers } from '../nodes-shared-code/delay-buffers'
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

interface NodeArguments {
    delayName: string,
    initDelayMsec: number,
}
const stateVariables = {
    delayName: 1,
    buffer: 1,
    delaySamp: 1,
    delayMsec: 1,
    funcSetDelayName: 1,
    funcSetDelayMsec: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : Implement 4-point interpolation for delread4
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        delayName: assertOptionalString(args[0]) || '',
        initDelayMsec: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        return undefined
    },
}

const makeNodeImplementation = (): _NodeImplementation => {
    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({ 
        state, 
        globs,
        node: { args }, 
        macros: { Var, Func }
    }) => `
        let ${Var(state.delayName, 'string')} = ""
        let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL
        let ${Var(state.delaySamp, 'Int')} = 0
        let ${Var(state.delayMsec, 'Float')} = 0

        const ${state.funcSetDelayMsec} = ${Func([
            Var('delayMsec', 'Float')
        ], 'void')} => {
            ${state.delayMsec} = delayMsec
            ${state.delaySamp} = toInt(Math.round(
                Math.min(
                    Math.max(computeUnitInSamples(${globs.sampleRate}, delayMsec, "msec"), 0), 
                    toFloat(${state.buffer}.length - 1)
                )
            ))
        }

        const ${state.funcSetDelayName} = ${Func([
            Var('delayName', 'string')
        ], 'void')} => {
            if (${state.delayName}.length) {
                ${state.buffer} = DELAY_BUFFERS_NULL
            }
            ${state.delayName} = delayName
            if (${state.delayName}.length) {
                DELAY_BUFFERS_get(${state.delayName}, () => { 
                    ${state.buffer} = DELAY_BUFFERS.get(${state.delayName})
                    ${state.funcSetDelayMsec}(${state.delayMsec})
                })
            }
        }

        commons_waitEngineConfigure(() => {
            if ("${args.delayName}".length) {
                ${state.funcSetDelayName}("${args.delayName}")
            }
            ${state.funcSetDelayMsec}(${args.initDelayMsec})
        })
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = (context) =>
        _hasSignalInput(context.node)
            ? loopSignal(context)
            : loopMessage(context)

    const loopMessage: _NodeImplementation['loop'] = ({ outs, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, ${state.delaySamp})
    `

    const loopSignal: _NodeImplementation['loop'] = ({ globs, outs, ins, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, toInt(Math.round(
            Math.min(
                Math.max(computeUnitInSamples(${globs.sampleRate}, ${ins.$0}, "msec"), 0), 
                toFloat(${state.buffer}.length - 1)
            )
        )))
    `

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
        '0_message': coldFloatInletWithSetter(globs.m, state.funcSetDelayMsec)
    })

    // ------------------------------------------------------------------- //
    return {
        loop,
        stateVariables,
        messages,
        declare,
        sharedCode: [ computeUnitInSamples, delayBuffers ]
    }

}

const _hasSignalInput = (node: DspGraph.Node<NodeArguments>) =>
    node.sources['0'] && node.sources['0'].length

const builders = {
    'delread~': builder,
    'delread4~': builder,
}

const nodeImplementations: NodeImplementations = {
    'delread~': makeNodeImplementation(),
    'delread4~': makeNodeImplementation(),
}

export { builders, nodeImplementations, NodeArguments }