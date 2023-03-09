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
import { assertString } from '../validation'
import { bangUtils } from '../nodes-shared-code/core'
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

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, node: { args: { typeArguments }} }) => ({
    '0': functional.renderCode`
        ${typeArguments.reverse().map((typeArg, i) => 
            `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, globs.m, 0)})`
        )}
        return
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    messages, 
    stateVariables, 
    sharedCode: [ 
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
