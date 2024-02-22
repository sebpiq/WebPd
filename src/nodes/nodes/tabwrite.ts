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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { nodeCoreTabBase, translateArgsTabBase, NodeArguments } from './tab-base'
import { Class, Sequence, stdlib } from '@webpd/compiler'
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
    state: ({ node: { args }, ns }) => 
        Class(ns.State!, [
            Var('FloatArray', 'array', ns.emptyArray!),
            Var('string', 'arrayName', `"${args.arrayName}"`),
            Var('SkedId', 'arrayChangesSubscription', 'SKED_ID_NULL'),
            Var('Int', 'readPosition', 0),
            Var('Int', 'readUntil', 0),
            Var('Int', 'writePosition', 0),
        ]),

    initialization: ({ ns, state }) => ast`
        if (${state}.arrayName.length) {
            ${ns.setArrayName!}(
                ${state}, 
                ${state}.arrayName,
                () => ${ns.setArrayNameFinalize!}(${state})
            )
        }
    `,

    messageReceivers: ({ ns, state}) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                if (${state}.array.length === 0) {
                    return

                } else {
                    ${state}.array[${state}.writePosition] = msg_readFloatToken(m, 0)
                    return
                }

            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${ns.setArrayName!}(
                    ${state}, 
                    msg_readStringToken(m, 1),
                    () => ${ns.setArrayNameFinalize!}(${state}),
                )
                return
        
            }
        `,

        '1': coldFloatInletWithSetter(ns.setWritePosition!, state)
    }),

    core: ({ ns }) => 
        Sequence([
            nodeCoreTabBase(ns),

            Func(ns.setArrayNameFinalize!, [
                Var(ns.State!, 'state'),
            ], 'void')`
                state.array = commons_getArray(state.arrayName)
            `,
        
            Func(ns.setWritePosition!, [
                Var(ns.State!, 'state'),
                Var('Float', 'writePosition')
            ], 'void')`
                state.writePosition = ${ns.prepareIndex!}(writePosition, state.array.length)
            `
        ]),

    dependencies: [
        stdlib.commonsArrays,
    ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}