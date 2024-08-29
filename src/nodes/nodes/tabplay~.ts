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
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { nodeCoreTabBase, NodeArguments } from './tab-base'

type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : Should work also if array was set the play started
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------ node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        alphaName: 'tabplay_t',
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

    messageReceivers: ({ ns, state }, { msg, bangUtils, actionUtils }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (${bangUtils.isBang}(m)) {
                ${ns.play}(${state}, 0, ${state}.array.length)
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
    
            } else if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {
                ${ns.play}(
                    ${state},
                    toInt(${msg.readFloatToken}(m, 0)), 
                    ${state}.array.length
                )
                return 
    
            } else if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}])) {
                ${ConstVar(`Int`, `fromSample`, `toInt(${msg.readFloatToken}(m, 0))`)}
                ${ns.play}(
                    ${state},
                    fromSample,
                    fromSample + toInt(${msg.readFloatToken}(m, 1)),
                )
                return
            }
        `,
    }),

    dsp: ({ state, snds, outs }, { bangUtils }) => ast`
        if (${state}.readPosition < ${state}.readUntil) {
            ${outs.$0} = ${state}.array[${state}.readPosition]
            ${state}.readPosition++
            if (${state}.readPosition >= ${state}.readUntil) {
                ${snds.$1}(${bangUtils.bang}())
            }
        } else {
            ${outs.$0} = 0
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
                state.readPosition = state.array.length
                state.readUntil = state.array.length
            `,
        
            Func(ns.play, [
                Var(ns.State, `state`),
                Var(`Int`, `playFrom`),
                Var(`Int`, `playTo`),
            ], 'void')`
                state.readPosition = playFrom
                state.readUntil = toInt(Math.min(
                    toFloat(playTo), 
                    toFloat(state.array.length),
                ))
            `,
        
            Func(ns.stop, [
                Var(ns.State, `state`),
            ], 'void')`
                state.readPosition = 0
                state.readUntil = 0
            `,
        ])
    },

    dependencies: [
        bangUtils,
        stdlib.commonsArrays,
        actionUtils,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}