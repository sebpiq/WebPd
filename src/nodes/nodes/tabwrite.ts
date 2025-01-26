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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { nodeCoreTabBase, translateArgsTabBase, NodeArguments } from './tab-base'
import { Class, NodeImplementation, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Func, Var, ast } from '@webpd/compiler'

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const nodeImplementation: _NodeImplementation = {
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
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {        
                if (${state}.array.length === 0) {
                    return

                } else {
                    ${state}.array[${state}.writePosition] = ${msg.readFloatToken}(m, 0)
                    return
                }

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
        
            }
        `,

        '1': coldFloatInletWithSetter(ns.setWritePosition, state, msg)
    }),

    core: ({ ns }, globals) => {
        const { commons } = globals
        return Sequence([
            nodeCoreTabBase(ns, globals),

            Func(ns.setArrayNameFinalize, [
                Var(ns.State, `state`),
            ], 'void')`
                state.array = ${commons.getArray}(state.arrayName)
            `,
        
            Func(ns.setWritePosition, [
                Var(ns.State, `state`),
                Var(`Float`, `writePosition`)
            ], 'void')`
                state.writePosition = ${ns.prepareIndex}(writePosition, state.array.length)
            `
        ])
    },

    dependencies: [
        stdlib.commonsArrays,
    ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}