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
import { assertOptionalString } from '../validation'
import { bangUtils, actionUtils } from '../global-code/core'
import { Class, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { nodeCoreTabBase, NodeArguments } from './tab-base'

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        isPullingSignal: true,
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {}
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------ node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'tabwrite_t',
    },

    state: ({ node: { args }, ns }, { sked }) => 
        Class(ns.State, [
            Var(`FloatArray`, `array`, ns.emptyArray),
            Var(`string`, `arrayName`, `"${args.arrayName}"`),
            Var(sked.Id, `arrayChangesSubscription`, sked.ID_NULL),
            Var(`Int`, `writePosition`, 0),
        ]),

    initialization: ({ ns, state }) => ast`
        if (${state}.arrayName.length) {
            ${ns.setArrayName}(
                ${state}, 
                ${state}.arrayName,
                () => ${ns.setArrayNameFinalize}(${state})
            )
        }
    `,

    messageReceivers: ({ ns, state }, { msg, bangUtils, actionUtils }) => ({
        '0_message': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${ns.start}(${state}, 0)
                return 
                
            } else if (${actionUtils.isAction}(m, 'stop')) {
                ${ns.stop}(${state})
                return 
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'set'
            ) {
                ${ns.setArrayName}(
                    ${state},
                    ${msg.readStringToken}(m, 1),
                    () => ${ns.setArrayNameFinalize}(${state}),
                )
                return
    
            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'start'
            ) {
                ${ns.start}(
                    ${state},
                    toInt(${msg.readFloatToken}(m, 1))
                )
                return 
    
            }
        `,
    }),

    dsp: ({ state, ins }) => ast`
        if (${state}.writePosition < ${state}.array.length) {
            ${state}.array[${state}.writePosition++] = ${ins.$0}
        }
    `,

    core: ({ ns }, globals) => {
        const { commons } = globals
        return Sequence([
            nodeCoreTabBase(ns, globals),

            Func(ns.setArrayNameFinalize, [
                Var(ns.State, `state`),
            ], 'void')`
                state.array = ${commons.getArray}(state.arrayName)
                state.writePosition = state.array.length
            `,
        
            Func(ns.start, [
                Var(ns.State, `state`),
                Var(`Int`, `writeFrom`),
            ], 'void')`
                state.writePosition = writeFrom
            `,
        
            Func(ns.stop, [
                Var(ns.State, `state`),
            ], 'void')`
                state.writePosition = state.array.length
            `,
        ])
    },

    dependencies: [
        stdlib.commonsArrays,
        actionUtils,
        bangUtils,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}