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

import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { delayBuffers } from '../nodes-shared-code/delay-buffers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

interface NodeArguments {
    delayName: string,
    initDelayMsec: number,
}
const stateVariables = {
    delayName: 1,
    buffer: 1,
    funcSetDelayName: 1,
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
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { initDelayMsec }) => {
        if (inletId === '0') {
            return  { initialSignalValue: initDelayMsec }
        }
        return undefined
    },
}

const makeNodeImplementation = (): _NodeImplementation => {
    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({ 
        state, 
        node: { args }, 
        macros: { Var, Func }
    }) => `
        let ${Var(state.delayName, 'string')} = ""
        let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL

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
                })
            }
        }

        commons_waitEngineConfigure(() => {
            if ("${args.delayName}".length) {
                ${state.funcSetDelayName}("${args.delayName}")
            }
        })
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = ({ globs, outs, ins, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, toInt(Math.round(
            Math.min(
                Math.max(computeUnitInSamples(${globs.sampleRate}, ${ins.$0}, "msec"), 0), 
                toFloat(${state.buffer}.length - 1)
            )
        )))
    `

    // ------------------------------------------------------------------- //
    return {
        loop,
        stateVariables,
        declare,
        sharedCode: [ computeUnitInSamples, delayBuffers ]
    }

}

const builders = {
    'delread~': builder,
    'delread4~': builder,
}

const nodeImplementations: NodeImplementations = {
    'delread~': makeNodeImplementation(),
    'delread4~': makeNodeImplementation(),
}

export { builders, nodeImplementations, NodeArguments }