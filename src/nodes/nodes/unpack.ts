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

import { functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/types'
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
