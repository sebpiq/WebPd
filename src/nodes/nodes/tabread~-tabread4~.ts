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
import { assertOptionalString } from '../validation'
import { bangUtils, actionUtils } from '../global-code/core'
import { Class, NodeImplementation, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'
import { nodeCoreTabBase, NodeArguments } from './tab-base'

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : tabread4 interpolation algorithm
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
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
        isDspInline: true,
        alphaName: 'tabread_t',
    },

    state: ({ node: { args }, ns }, { sked }) => 
        Class(ns.State, [
            Var(`FloatArray`, `array`, ns.emptyArray),
            Var(`string`, `arrayName`, `"${args.arrayName}"`),
            Var(sked.Id, `arrayChangesSubscription`, sked.ID_NULL),
            Var(`Int`, `readPosition`, 0),
            Var(`Int`, `readUntil`, 0),
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

    messageReceivers: ({ ns, state }, { msg }) => ({
        '0_message': AnonFunc([Var(msg.Message, `m`)])`
            if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'set'
            ) {
                ${ns.setArrayName}(
                    ${state},
                    ${msg.readStringToken}(m, 1),
                    () => ${ns.setArrayNameFinalize}(${state}),
                )
                return
    
            }
        `,
    }),

    dsp: ({ ins, state }) => 
        ast`${state}.array[toInt(Math.max(Math.min(Math.floor(${ins.$0}), toFloat(${state}.array.length - 1)), 0))]`,
    
    core: ({ ns }, globals) => {
        const { commons } = globals
        return Sequence([
            nodeCoreTabBase(ns, globals),

            Func(ns.setArrayNameFinalize, [
                Var(ns.State, `state`),
            ], 'void')`
                state.array = ${commons.getArray}(state.arrayName)
            `,
        ])
    },

    dependencies: [
        bangUtils,
        stdlib.commonsArrays,
        actionUtils,
    ],
}

const builders = {
    'tabread~': builder,
    'tabread4~': builder,
}

const nodeImplementations = {
    'tabread~': nodeImplementation,
    'tabread4~': nodeImplementation,
}

export { 
    builders,
    nodeImplementations,
    NodeArguments,
}