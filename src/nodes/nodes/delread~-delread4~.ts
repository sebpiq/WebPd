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

import { AnonFunc, Class, Sequence, stdlib } from '@webpd/compiler'
import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { delayBuffers } from '../global-code/delay-buffers'
import { computeUnitInSamples } from '../global-code/timing'
import { Func, Var, ast } from '@webpd/compiler'
import { VariableName } from '@webpd/compiler/src/ast/types'

interface NodeArguments {
    delayName: string,
    initDelayMsec: number,
}
type _NodeImplementation = NodeImplementation<NodeArguments>

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

// ------------------------------- node implementation - shared ------------------------------ //
const variableNamesSharedList = [
    'NOOP',
    'setDelayName',
    'setRawOffset',
    'updateOffset',
]

const sharedNodeImplementation: _NodeImplementation = {

    state: ({ ns }) => 
        Class(ns.State!, [
            Var('string', 'delayName', '""'),
            Var('buf_SoundBuffer', 'buffer', 'DELAY_BUFFERS_NULL'),
            Var('Float', 'rawOffset', 0),
            Var('Int', 'offset', 0),
            Var('(_: string) => void', 'setDelayNameCallback', ns.NOOP!)
        ]),

    initialization: ({ ns, node: { args }, state }) => ast`
        ${state}.setDelayNameCallback = ${AnonFunc([Var('string', '_')])`
            ${state}.buffer = DELAY_BUFFERS.get(${state}.delayName)
            ${ns.updateOffset!}(${state})
        `}

        if ("${args.delayName}".length) {
            ${ns.setDelayName!}(${state}, "${args.delayName}", ${state}.setDelayNameCallback)
        }
    `,

    dsp: ({ ns, state, outs, ins }) => ({
        inlets: {
            '0': ast`${ns.setRawOffset!}(${state}, ${ins.$0})`
        },    
        loop: ast`${outs.$0} = buf_readSample(${state}.buffer, ${state}.offset)`,
    }),

    core: ({ ns, globs }) => 
        Sequence([
            Func(ns.setDelayName!, [
                Var(ns.State!, 'state'),
                Var('string', 'delayName'),
                Var('SkedCallback', 'callback'),
            ])`
                if (state.delayName.length) {
                    state.buffer = DELAY_BUFFERS_NULL
                }
                state.delayName = delayName
                if (state.delayName.length) {
                    DELAY_BUFFERS_get(state.delayName, callback)
                }
            `,

            Func(ns.setRawOffset!, [
                Var(ns.State!, 'state'),
                Var('Float', 'rawOffset'),
            ])`
                state.rawOffset = rawOffset
                ${ns.updateOffset!}(state)
            `,

            Func(ns.updateOffset!, [
                Var(ns.State!, 'state'),
            ])`
                state.offset = toInt(Math.round(
                    Math.min(
                        Math.max(computeUnitInSamples(${globs.sampleRate}, state.rawOffset, "msec"), 0), 
                        toFloat(state.buffer.length - 1)
                    )
                ))
            `,

            Func(ns.NOOP!, [
                Var('string', '_')
            ])``,
        ]),

    dependencies: [
        computeUnitInSamples,
        delayBuffers,
        stdlib.bufWriteRead,
    ],
}

const builders = {
    'delread~': builder,
    'delread4~': builder,
}

const nodeImplementations: NodeImplementations = {
    'delread~': {
        ...sharedNodeImplementation,
        flags: {
            alphaName: 'delread_t',
        },
    },
    'delread4~': {
        ...sharedNodeImplementation,
        flags: {
            alphaName: 'delread4_t',
        },
    },
}

export { builders, nodeImplementations, NodeArguments }