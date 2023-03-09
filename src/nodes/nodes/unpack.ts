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
import { resolveTypeArgumentAlias, TypeArgument } from '../type-arguments'

interface NodeArguments {
    typeArguments: Array<TypeArgument>
}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        typeArguments: args.length === 0 ? ['float', 'float']: args
            .map(resolveTypeArgumentAlias)
            .map(arg => {
                if (typeof arg === 'number') {
                    return 'float'

                } else if (arg === 'symbol' || arg === 'float') {
                    return arg

                } else {
                    throw new Error(`Invalid type argument for unpack "${arg}"`)
                }
            }),
    }),
    build: ({ typeArguments }) => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: functional.mapArray(
            typeArguments, 
            (_, i) => [`${i}`, { type: 'message', id: `${i}` }],
        ),
    }),
}

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, node: { args } }) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [${
        args.typeArguments.map(t => t === 'float' ? 'MSG_FLOAT_TOKEN': 'MSG_STRING_TOKEN').join(',')}])
    ) {
        ${args.typeArguments.reverse().map((t, i) => {
            const reversedI = args.typeArguments.length - i - 1
            return functional.renderSwitch(
                [t === 'float', `${snds[reversedI]}(msg_floats([msg_readFloatToken(${globs.m}, ${reversedI})]))`],
                [t === 'symbol', `${snds[reversedI]}(msg_strings([msg_readStringToken(${globs.m}, ${reversedI})]))`],
            )
        })}
        return
    }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages,
    stateVariables,
}

export { builder, nodeImplementation, NodeArguments }
