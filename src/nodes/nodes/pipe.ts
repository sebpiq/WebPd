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
import { assertNumber } from '../validation'
import { bangUtils, stringMsgUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import {
    messageTokenToFloat,
    messageTokenToString,
    assertTypeArgument,
    renderMessageTransfer,
    resolveTypeArgumentAlias,
    TypeArgument,
} from '../type-arguments'

interface NodeArguments {
    typeArguments: Array<[TypeArgument, number | string]>
    delay: number
}
const stateVariables = {
    delay: 1,
    scheduledMessages: 1,
    scheduledFrames: 1,
    lastReceived: 1,
    funcScheduleMessage: 1,
    funcSetDelay: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => {
        let delay: number = 0
        if (args.length >= 1) {
            delay = assertNumber(args[args.length - 1])
            args = args.slice(0, -1)
        }
        args = args.length ? args: [0]

        return {
            typeArguments: args.map(resolveTypeArgumentAlias)
                .map(value => [
                    typeof value === 'number' ? 'float' : assertTypeArgument(value),
                    typeof value === 'number' ? value : value === 'float' ? 0: 'symbol'
                ]),
            delay
        }
    },
    build: (args) => ({
        inlets: {
            ...functional.mapArray(
                args.typeArguments, 
                (_, i) => [`${i}`, { type: 'message', id: `${i}` }]
            ),
            [`${args.typeArguments.length}`]: { 
                type: 'message', 
                id: `${args.typeArguments.length}` 
            },
        },
        outlets: functional.mapArray(
            args.typeArguments, 
            (_, i) => [`${i}`, { type: 'message', id: `${i}` }],
        ),
    }),
}

// ------------------------------- declare ------------------------------ //
// !!! Array.splice insertion is not supported by assemblyscript, so : 
// 1. We grow arrays to their post-insertion size by using `push`
// 2. We use `copyWithin` to move old elements to their final position.
// 3. We insert the new elements at their place.
const declare: _NodeImplementation['declare'] = ({
    state,
    globs,
    node: { args },
    macros: { Var, Func },
}) => functional.renderCode`
    let ${state.delay} = 0
    let ${Var(state.scheduledMessages, 'Array<Message>')} = []
    let ${Var(state.scheduledFrames, 'Array<Int>')} = []
    const ${Var(state.lastReceived, 'Array<Message>')} = [${
        args.typeArguments
            .map(([_, value]) => typeof value === 'number' ? 
                `msg_floats([${value}])`
                : `msg_strings(["${value}"])`).join(',')
    }]

    const ${state.funcScheduleMessage} = ${Func([
        Var('inMessage', 'Message')
    ], 'void')} => {
        let ${Var('insertIndex', 'Int')} = 0
        let ${Var('frame', 'Int')} = ${globs.frame} + ${state.delay}
        let ${Var('outMessage', 'Message')} = msg_create([])

        while (
            insertIndex < ${state.scheduledFrames}.length 
            && ${state.scheduledFrames}[insertIndex] <= frame
        ) {insertIndex++}

        
        ${functional.countTo(args.typeArguments.length).map(_ => 
            `${state.scheduledMessages}.push(msg_create([]))`)}
        ${state.scheduledMessages}.copyWithin((insertIndex + 1) * ${args.typeArguments.length}, insertIndex * ${args.typeArguments.length})
        ${state.scheduledFrames}.push(0)
        ${state.scheduledFrames}.copyWithin(insertIndex + 1, insertIndex)

        ${args.typeArguments.reverse()
            .map<[number, TypeArgument]>(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
            .map(([iReverse, typeArg], i) => `
                if (msg_getLength(inMessage) > ${iReverse}) {
                    outMessage = ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                    ${state.lastReceived}[${iReverse}] = outMessage
                } else {
                    outMessage = ${state.lastReceived}[${iReverse}]
                }
                ${state.scheduledMessages}[insertIndex * ${args.typeArguments.length} + ${i}] = outMessage
            `)}
        ${state.scheduledFrames}[insertIndex] = frame
    }

    const ${state.funcSetDelay} = ${Func([
        Var('delay', 'Float')
    ], 'void')} => {
        ${state.delay} = toInt(Math.round(delay / 1000 * ${globs.sampleRate}))
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetDelay}(${args.delay})
    })
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({
    node,
    state,
    globs,
    snds,
}) => `
    while (${state.scheduledFrames}.length && ${state.scheduledFrames}[0] <= ${globs.frame}) {
        ${state.scheduledFrames}.shift()
        ${functional.countTo(node.args.typeArguments.length).reverse()
            .map((i) => `${snds[i]}(${state.scheduledMessages}.shift())`)}
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ node, snds, globs, state, macros: { Var } }) => ({
    '0': functional.renderCode`
    if (msg_isBang(${globs.m})) {
        ${state.funcScheduleMessage}(msg_create([]))
        return

    } else if (msg_isAction(${globs.m}, 'clear')) {
            ${state.scheduledMessages} = []
            ${state.scheduledFrames} = []
            return 

    } else if (msg_isAction(${globs.m}, 'flush')) {
        ${state.scheduledFrames} = []
        while (${state.scheduledMessages}.length) {
            ${functional.countTo(node.args.typeArguments.length).reverse()
                .map((i) => `${snds[i]}(${state.scheduledMessages}.shift())`)}
        }
        return

    } else {
        ${state.funcScheduleMessage}(${globs.m})
        return
    }
    `,

    ...functional.mapArray(
        node.args.typeArguments.slice(1), 
        ([typeArg], i) => [
            `${i + 1}`, 
            `${state.lastReceived}[${i + 1}] = ${renderMessageTransfer(typeArg, globs.m, 0)}
            return`
        ]
    ),

    [node.args.typeArguments.length]: coldFloatInletWithSetter(globs.m, state.funcSetDelay)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    loop,
    messages, 
    stateVariables, 
    declare,
    sharedCode: [ 
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
