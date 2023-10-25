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

interface NodeArguments {
    typeArguments: Array<TypeArgument>
}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ snds, globs, node: { args: { typeArguments }} }) => ({
    '0': functional.renderCode`
        ${typeArguments.reverse().map((typeArg, i) => 
            `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, globs.m, 0)})`
        )}
        return
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    generateMessageReceivers, 
    stateVariables, 
    dependencies: [ 
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
