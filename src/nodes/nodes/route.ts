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

import { Class, DspGraph, Sequence, functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { bangUtils, msgUtils } from '../global-code/core'
import { AnonFunc, Var } from '@webpd/compiler'

interface NodeArguments {
    filters: Array<number | string>
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        filters: args.length ? args: [0],
    }),
    build: (args) => {
        const inlets: DspGraph.PortletMap = {
            '0': { type: 'message', id: '0' },
        }

        if (args.filters.length === 1) {
            inlets['1'] = { type: 'message', id: '1' }
        }

        return {
            inlets,
            outlets: functional.mapArray(
                args.filters.length ? functional.countTo(args.filters.length + 1) : [0, 1],
                (_, i) => [`${i}`, { type: 'message', id: `${i}` }],
            ),
        }
    },
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = { 
    state: ({ node: { args }, ns }, { msg }) => 
        Class(ns.State, [
            Var(`Float`, `floatFilter`, typeof args.filters[0] === `number` ? args.filters[0]: 0),
            Var(`string`, `stringFilter`, `"${args.filters[0]}"`),
            Var(`Int`, `filterType`, typeof args.filters[0] === `number` ? msg.FLOAT_TOKEN : msg.STRING_TOKEN),
        ]),

    messageReceivers: (
        { snds, state, node: { args } }, 
        { msg, bangUtils, msgUtils }
    ) => {
        if (args.filters.length > 1) {
            return {
                '0': AnonFunc([Var(msg.Message, `m`)])`
                    ${args.filters.map((filter, i) => functional.renderSwitch(
                        [filter === 'float', `
                            if (${msg.isFloatToken}(m, 0)) {
                                ${snds[i]}(m)
                                return
                            }
                        `],
                        [filter === 'symbol', `
                            if (${msg.isStringToken}(m, 0)) {
                                ${snds[i]}(m)
                                return
                            }
                        `],
                        [filter === 'list', `
                            if (${msg.getLength}(m).length > 1) {
                                ${snds[i]}(m)
                                return
                            }
                        `],
                        [filter === 'bang', `
                            if (${bangUtils.isBang}(m)) {
                                ${snds[i]}(m)
                                return
                            }
                        `],
                        [typeof filter === 'number', `
                            if (
                                ${msg.isFloatToken}(m, 0)
                                && ${msg.readFloatToken}(m, 0) === ${filter}
                            ) {
                                ${snds[i]}(${bangUtils.emptyToBang}(${msgUtils.shift}(m)))
                                return
                            }
                        `],
                        [typeof filter === 'string', `
                            if (
                                ${msg.isStringToken}(m, 0) 
                                && ${msg.readStringToken}(m, 0) === "${filter}"
                            ) {
                                ${snds[i]}(${bangUtils.emptyToBang}(${msgUtils.shift}(m)))
                                return
                            }`
                        ],
                    ))}
    
                    ${snds[args.filters.length]}(m)
                    return
                `
            }
        
        } else {
            return {
                '0': AnonFunc([Var(msg.Message, `m`)])`
                    if (${state}.filterType === ${msg.STRING_TOKEN}) {
                        if (
                            (${state}.stringFilter === 'float'
                                && ${msg.isFloatToken}(m, 0))
                            || (${state}.stringFilter === 'symbol'
                                && ${msg.isStringToken}(m, 0))
                            || (${state}.stringFilter === 'list'
                                && ${msg.getLength}(m) > 1)
                            || (${state}.stringFilter === 'bang' 
                                && ${bangUtils.isBang}(m))
                        ) {
                            ${snds.$0}(m)
                            return
                        
                        } else if (
                            ${msg.isStringToken}(m, 0)
                            && ${msg.readStringToken}(m, 0) === ${state}.stringFilter
                        ) {
                            ${snds.$0}(${bangUtils.emptyToBang}(${msgUtils.shift}(m)))
                            return
                        }
    
                    } else if (
                        ${msg.isFloatToken}(m, 0)
                        && ${msg.readFloatToken}(m, 0) === ${state}.floatFilter
                    ) {
                        ${snds.$0}(${bangUtils.emptyToBang}(${msgUtils.shift}(m)))
                        return
                    }
                
                    ${snds.$1}(m)
                return
                `,
    
                '1': AnonFunc([Var(msg.Message, `m`)])`
                    ${state}.filterType = ${msg.getTokenType}(m, 0)
                    if (${state}.filterType === ${msg.STRING_TOKEN}) {
                        ${state}.stringFilter = ${msg.readStringToken}(m, 0)
                    } else {
                        ${state}.floatFilter = ${msg.readFloatToken}(m, 0)
                    }
                    return
                `
            }
        }
        
    },

    dependencies: [ 
        bangUtils, 
        msgUtils,
    ]
}

export { builder, nodeImplementation, NodeArguments }
