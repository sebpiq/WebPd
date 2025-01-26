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

import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { actionUtils } from '../global-code/core'
import { delayBuffers } from '../global-code/delay-buffers'
import { computeUnitInSamples } from '../global-code/timing'
import {
    AnonFunc,
    Class,
    Func,
    NodeImplementation,
    Sequence,
    Var,
    ast,
    stdlib,
} from '@webpd/compiler'

interface NodeArguments {
    delayName: string,
    maxDurationMsec: number,
}

type _NodeImplementation = NodeImplementation<NodeArguments>

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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------- node implementation ------------------------------ //

const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'delwrite_t',
    },

    state: ({ ns }, { buf, delayBuffers }) => 
        Class(ns.State, [
            Var(`string`, `delayName`, `""`),
            Var(buf.SoundBuffer, `buffer`, delayBuffers.NULL_BUFFER),
        ]),

    initialization: ({ ns, node: { args }, state }, { buf, core }) => ast`
        ${state}.buffer = ${buf.create}(
            toInt(Math.ceil(computeUnitInSamples(
                ${core.SAMPLE_RATE}, 
                ${args.maxDurationMsec},
                "msec"
            )))
        )
        if ("${args.delayName}".length) {
            ${ns.setDelayName}(${state}, "${args.delayName}")
        }
    `,

    dsp: ({ ins, state }, { buf }) => 
        ast`${buf.writeSample}(${state}.buffer, ${ins.$0})`,

    messageReceivers: ({ state }, { buf, msg, actionUtils }) => ({
        '0_message': AnonFunc([ Var(msg.Message, `m`) ], `void`)`
            if (${actionUtils.isAction}(m, 'clear')) {
                ${buf.clear}(${state}.buffer)
                return
            }
        `
    }),

    core: ({ ns }, { delayBuffers }) => 
        Sequence([
            Func(ns.setDelayName, [
                Var(ns.State, `state`),
                Var(`string`, `delayName`)
            ], 'void')`
                if (state.delayName.length) {
                    ${delayBuffers.delete}(state.delayName)
                }
                state.delayName = delayName
                if (state.delayName.length) {
                    ${delayBuffers.set}(state.delayName, state.buffer)
                }
            `
        ]),

    dependencies: [ 
        computeUnitInSamples, 
        delayBuffers, 
        actionUtils,
        stdlib.bufWriteRead,
    ]
}

export { builder, nodeImplementation, NodeArguments }