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
import { assertString } from '../validation'
import { bangUtils } from '../global-code/core'
import {
    messageTokenToFloat,
    messageTokenToString,
    assertTypeArgument,
    renderMessageTransfer,
    resolveTypeArgumentAlias,
    TypeArgument,
} from '../type-arguments'
import { AnonFunc, Var, functional } from '@webpd/compiler'

interface NodeArguments {
    typeArguments: Array<TypeArgument>
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// TODO : 
// - pointer
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        typeArguments: args.length === 0 ? ['bang', 'bang'] : args
            .map(assertString)
            .map(resolveTypeArgumentAlias)
            .map(assertTypeArgument),
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

// ---------------------------------- node implementation --------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    messageReceivers: ({ snds, node: { args: { typeArguments }} }, globals) => ({
        '0': AnonFunc([
            Var(globals.msg.Message, `m`)
        ])`
            ${typeArguments.reverse().map((typeArg, i) => 
                `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, 'm', 0, globals)})`
            )}
            return
        `,
    }),  

    dependencies: [ 
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
