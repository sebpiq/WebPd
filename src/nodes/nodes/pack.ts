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

import { Class, functional, Sequence } from '@webpd/compiler'
import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { bangUtils } from '../global-code/core'
import { assertTypeArgument, messageTokenToFloat, messageTokenToString, resolveTypeArgumentAlias, TypeArgument } from '../type-arguments'
import { AnonFunc, ast, ConstVar, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

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

// ------------------------------- generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('pack')

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Class(variableNames.stateClass, [
        Var('Array<Float>', 'floatValues'),
        Var('Array<string>', 'stringValues'),
    ]),
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args }, state }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            floatValues: [${
                args.typeArguments.map(([typeArg, defaultValue]) => 
                    typeArg === 'float' ? defaultValue: 0
                ).join(',')
            }],
            stringValues: [${
                args.typeArguments.map(([typeArg, defaultValue]) => 
                    typeArg === 'symbol' ? `"${defaultValue}"`: '""'
                ).join(',')
            }]
        }`)}
    `

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ snds, state, node }) => ({
    '0': AnonFunc([Var('Message', 'm')])`
        if (!msg_isBang(m)) {
            for (${Var('Int', 'i', '0')}; i < msg_getLength(m); i++) {
                ${state}.stringValues[i] = messageTokenToString(m, i)
                ${state}.floatValues[i] = messageTokenToFloat(m, i)
            }
        }

        ${ConstVar('MessageTemplate', 'template', `[${
            node.args.typeArguments.map(([typeArg], i) => 
                typeArg === 'symbol' ? 
                    `MSG_STRING_TOKEN, ${state}.stringValues[${i}].length`
                    : `MSG_FLOAT_TOKEN`
                ).join(',')
        }]`)}

        ${ConstVar('Message', 'messageOut', 'msg_create(template)')}

        ${node.args.typeArguments.map(([typeArg], i) => 
            typeArg === 'symbol' ? 
                `msg_writeStringToken(messageOut, ${i}, ${state}.stringValues[${i}])`
                : `msg_writeFloatToken(messageOut, ${i}, ${state}.floatValues[${i}])`)}

        ${snds[0]}(messageOut)
        return
    `,

    ...functional.mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => {
        if (typeArg === 'symbol') {
            return [
                `${i + 1}`, 
                AnonFunc([Var('Message', 'm')])`
                    ${state}.stringValues[${i + 1}] = messageTokenToString(m, 0)
                    return
                `
            ]
        } else if (typeArg === 'float') {
            return [
                `${i + 1}`, 
                AnonFunc([Var('Message', 'm')])`
                    ${state}.floatValues[${i + 1}] = messageTokenToFloat(m, 0)
                    return
                `
            ]
        } else {
            throw new Error(`Unsupported type argument ${typeArg}`)
        }
    }),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    messageReceivers: messageReceivers,
    initialization: initialization,
    dependencies: [ 
        messageTokenToString, 
        messageTokenToFloat, 
        bangUtils, 
        nodeCore,
    ]
}

export { builder, nodeImplementation, NodeArguments }
