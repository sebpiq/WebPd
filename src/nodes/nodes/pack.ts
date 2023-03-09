/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { functional } from '@webpd/compiler-js'
import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { bangUtils } from '../nodes-shared-code/core'
import { assertTypeArgument, messageTokenToFloat, messageTokenToString, resolveTypeArgumentAlias, TypeArgument } from '../type-arguments'

interface NodeArguments {
    typeArguments: Array<[TypeArgument, number | string]>
}
const stateVariables = {
    floatValues: 1,
    stringValues: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        typeArguments: (args.length ? args : ['float']).map(resolveTypeArgumentAlias)
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

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    node: { args },
    state,
    macros: { Var },
}) => functional.renderCode`
    const ${Var(state.floatValues, 'Array<Float>')} = [${
        args.typeArguments.map(([typeArg, defaultValue]) => 
            `${typeArg === 'float' ? defaultValue: 0}`).join(',')}]
    const ${Var(state.stringValues, 'Array<string>')} = [${
        args.typeArguments.map(([typeArg, defaultValue]) => 
            `${typeArg === 'symbol' ? `"${defaultValue}"`: '""'}`).join(',')}]
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state, node, macros: { Var } }) => ({
    '0': functional.renderCode`
    if (!msg_isBang(${globs.m})) {
        for (let ${Var('i', 'Int')} = 0; i < msg_getLength(${globs.m}); i++) {
            ${state.stringValues}[i] = messageTokenToString(${globs.m}, i)
            ${state.floatValues}[i] = messageTokenToFloat(${globs.m}, i)
        }
    }

    const ${Var('template', 'MessageTemplate')} = [${
        node.args.typeArguments.map(([typeArg], i) => 
            typeArg === 'symbol' ? 
                `MSG_STRING_TOKEN,${state.stringValues}[${i}].length`
                : `MSG_FLOAT_TOKEN`).join(',')}]

    const ${Var('messageOut', 'Message')} = msg_create(template)

    ${node.args.typeArguments.map(([typeArg], i) => 
        typeArg === 'symbol' ? 
            `msg_writeStringToken(messageOut, ${i}, ${state.stringValues}[${i}])`
            : `msg_writeFloatToken(messageOut, ${i}, ${state.floatValues}[${i}])`)}

    ${snds[0]}(messageOut)
    return
    `,

    ...functional.mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => 
        [
            `${i + 1}`, 
            functional.renderSwitch(
                [
                    typeArg === 'symbol', 
                    `${state.stringValues}[${i + 1}] = messageTokenToString(${globs.m}, 0)`
                ],
                [
                    typeArg === 'float', 
                    `${state.floatValues}[${i + 1}] = messageTokenToFloat(${globs.m}, 0)`
                ],
            ) + ';return'
        ]
    ),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    messages, 
    stateVariables, 
    declare,
    sharedCode: [ messageTokenToString, messageTokenToFloat, bangUtils ]
}

export { builder, nodeImplementation, NodeArguments }
