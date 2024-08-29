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

import { Class, functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { bangUtils } from '../global-code/core'
import { assertTypeArgument, messageTokenToFloat, messageTokenToString, resolveTypeArgumentAlias, TypeArgument } from '../type-arguments'
import { AnonFunc, ConstVar, Var } from '@webpd/compiler'

interface NodeArguments {
    typeArguments: Array<[TypeArgument, number | string]>
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        typeArguments: (args.length ? args : ['float', 'float']).map(resolveTypeArgumentAlias)
            // Not sure why but 'bang' is supported as a creation argument, 
            // but turned into a float.
            .map(typeArg => {
                // Assign default value
                typeArg = typeArg || 'float'
                
                if (typeArg === 'bang') {
                    typeArg = 'float'
                }

                if (typeof typeArg === 'number') {
                    return typeArg

                } else if (!['float', 'symbol'].includes(typeArg)) {
                    throw new Error(`${typeArg} not supported (yet)`)

                }
                return typeArg
            })
            .map(value => [
                typeof value === 'number' ? 'float' : assertTypeArgument(value),
                typeof value === 'number' ? value : value === 'float' ? 0: 'symbol'
            ]),
    }),
    build: ({ typeArguments }) => ({ 
        inlets: functional.mapArray(
            typeArguments, 
            (_, i) => [`${i}`, { type: 'message', id: `${i}` }],
        ),

        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = { 
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Array<Float>`, `floatValues`, `[${
                args.typeArguments.map(([typeArg, defaultValue]) => 
                    typeArg === 'float' ? defaultValue: 0
                ).join(',')
            }]`),
            Var(`Array<string>`, `stringValues`, `[${
                args.typeArguments.map(([typeArg, defaultValue]) => 
                    typeArg === 'symbol' ? `"${defaultValue}"`: '""'
                ).join(',')
            }]`),
        ]),

    messageReceivers: (
        { snds, state, node }, 
        { bangUtils, tokenConversion, msg }
    ) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (!${bangUtils.isBang}(m)) {
                for (${Var(`Int`, `i`, `0`)}; i < ${msg.getLength}(m); i++) {
                    ${state}.stringValues[i] = ${tokenConversion.toString_}(m, i)
                    ${state}.floatValues[i] = ${tokenConversion.toFloat}(m, i)
                }
            }
    
            ${ConstVar(msg.Template, `template`, `[${
                node.args.typeArguments.map(([typeArg], i) => 
                    typeArg === 'symbol' ? 
                        `${msg.STRING_TOKEN}, ${state}.stringValues[${i}].length`
                        : `${msg.FLOAT_TOKEN}`
                    ).join(',')
            }]`)}
    
            ${ConstVar(msg.Message, `messageOut`, `${msg.create}(template)`)}
    
            ${node.args.typeArguments.map(([typeArg], i) => 
                typeArg === 'symbol' ? 
                    `${msg.writeStringToken}(messageOut, ${i}, ${state}.stringValues[${i}])`
                    : `${msg.writeFloatToken}(messageOut, ${i}, ${state}.floatValues[${i}])`)}
    
            ${snds[0]}(messageOut)
            return
        `,
    
        ...functional.mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => {
            if (typeArg === 'symbol') {
                return [
                    `${i + 1}`, 
                    AnonFunc([Var(msg.Message, `m`)])`
                        ${state}.stringValues[${i + 1}] = ${tokenConversion.toString_}(m, 0)
                        return
                    `
                ]
            } else if (typeArg === 'float') {
                return [
                    `${i + 1}`, 
                    AnonFunc([Var(msg.Message, `m`)])`
                        ${state}.floatValues[${i + 1}] = ${tokenConversion.toFloat}(m, 0)
                        return
                    `
                ]
            } else {
                throw new Error(`Unsupported type argument ${typeArg}`)
            }
        }),
    }),

    dependencies: [ 
        messageTokenToString, 
        messageTokenToFloat, 
        bangUtils,
    ]
}

export { builder, nodeImplementation, NodeArguments }
