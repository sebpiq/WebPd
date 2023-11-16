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

import { stdlib, functional } from '@webpd/compiler'
import { NodeImplementation, GlobalCodeDefinition } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertNumber } from '../validation'
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import {
    messageTokenToFloat,
    messageTokenToString,
    assertTypeArgument,
    renderMessageTransfer,
    resolveTypeArgumentAlias,
    TypeArgument,
} from '../type-arguments'
import { AnonFunc, Class, ConstVar, Func, Var, ast } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {
    typeArguments: Array<[TypeArgument, number | string]>
    delay: number
}
const stateVariables = {
    delay: 1,
    scheduledMessages: 1,
    outputMessages: 1,
    funcScheduleMessage: 1,
    funcSetDelay: 1,
    funcSendMessages: 1,
    funcWaitFrameCallback: 1,
    funcClear: 1,
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

// ------------------------------- dependencies ------------------------------ //
const pipeGlobalCode: GlobalCodeDefinition = () => 
    Class('pipe_ScheduledMessage', [
        Var('Message', 'message'), 
        Var('Int', 'frame'), 
        Var('SkedId', 'skedId'), 
    ])

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    state,
    globs,
    snds,
    node: { args },
}) => ast`
    ${Var('Int', state.delay, 0)}
    ${ConstVar('Array<Message>', state.outputMessages, `[${
        args.typeArguments
            .map(([_, value]) => typeof value === 'number' ? 
                `msg_floats([${value}])`
                : `msg_strings(["${value}"])`).join(',')
    }]`)}
    ${Var('Array<pipe_ScheduledMessage>', state.scheduledMessages, '[]')}

    ${Func(state.funcScheduleMessage, [
        Var('Message', 'inMessage')
    ], 'void')`
        ${Var('Int', 'insertIndex', '0')}
        ${Var('Int', 'frame', `${globs.frame} + ${state.delay}`)}
        ${Var('SkedId', 'skedId', 'SKED_ID_NULL')}
        ${Var('pipe_ScheduledMessage', 'scheduledMessage', `{
            message: msg_create([]),
            frame: frame,
            skedId: SKED_ID_NULL,
        }`)}

        ${''
        // !!! Array.splice insertion is not supported by assemblyscript, so : 
        // 1. We grow arrays to their post-insertion size by using `push`
        // 2. We use `copyWithin` to move old elements to their final position.
        }
        while (
            insertIndex < ${state.scheduledMessages}.length 
            && ${state.scheduledMessages}[insertIndex].frame <= frame
        ) {
            insertIndex++
        }

        ${functional.countTo(args.typeArguments.length).map(_ => 
            `${state.scheduledMessages}.push(scheduledMessage)`
        )}
        ${state.scheduledMessages}.copyWithin(
            (insertIndex + 1) * ${args.typeArguments.length}, 
            insertIndex * ${args.typeArguments.length}
        )

        ${''
        // If there was not yet a callback scheduled for that frame, we schedule it.
        }
        if (
            insertIndex === 0 || 
            (
                insertIndex > 0 
                && ${state.scheduledMessages}[insertIndex - 1].frame !== frame
            )
        ) {
            skedId = commons_waitFrame(frame, ${state.funcWaitFrameCallback})
        }

        ${''
        // Finally, schedule a message for each outlet
        }
        ${args.typeArguments.reverse()
            .map<[number, TypeArgument]>(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
            .map(([iReverse, typeArg], i) => 
                `
                    scheduledMessage = ${state.scheduledMessages}[insertIndex + ${i}] = {
                        message: msg_create([]),
                        frame: frame,
                        skedId: skedId,
                    }
                    if (msg_getLength(inMessage) > ${iReverse}) {
                        scheduledMessage.message = ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                        ${state.outputMessages}[${iReverse}] = scheduledMessage.message
                    } else {
                        scheduledMessage.message = ${state.outputMessages}[${iReverse}]
                    }
                `
            )
        }
    `}

    ${Func(state.funcSendMessages, [Var('Int', 'toFrame')], 'void')`
        while (
            ${state.scheduledMessages}.length 
            && ${state.scheduledMessages}[0].frame <= toFrame
        ) {
            ${functional.countTo(args.typeArguments.length)
                .reverse()
                .map((i) => 
                    `${snds[i]}(${state.scheduledMessages}.shift().message)`
                )
            }
        }
    `}

    ${Func(state.funcWaitFrameCallback, [
        Var('SkedEvent', 'event')
    ], 'void')`
        ${state.funcSendMessages}(${globs.frame})
    `}

    ${Func(state.funcClear, [], 'void')`
        ${Var('Int', 'i', '0')}
        ${ConstVar('Int', 'length', `${state.scheduledMessages}.length`)}
        for (i; i < length; i++) {
            commons_cancelWaitFrame(${state.scheduledMessages}[i].skedId)
        }
        ${state.scheduledMessages} = []
    `}

    ${Func(state.funcSetDelay, [
        Var('Float', 'delay')
    ], 'void')`
        ${state.delay} = toInt(Math.round(delay / 1000 * ${globs.sampleRate}))
    `}

    commons_waitEngineConfigure(() => {
        ${state.funcSetDelay}(${args.delay})
    })
`

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ node, snds, globs, state }) => ({
    '0': AnonFunc([Var('Message', 'm')], 'void')`
        if (msg_isBang(m)) {
            ${state.funcScheduleMessage}(msg_create([]))
            return

        } else if (msg_isAction(m, 'clear')) {
            ${state.funcClear}()
            return 

        } else if (msg_isAction(m, 'flush')) {
            if (${state.scheduledMessages}.length) {
                ${state.funcSendMessages}(${state.scheduledMessages}[${state.scheduledMessages}.length - 1].frame)
            }
            return

        } else {
            ${state.funcScheduleMessage}(m)
            return
        }
    `,

    ...functional.mapArray(
        node.args.typeArguments.slice(1), 
        ([typeArg], i) => [
            `${i + 1}`, 
            AnonFunc([Var('Message', 'm')], 'void')`
                ${state.outputMessages}[${i + 1}] = ${renderMessageTransfer(typeArg, 'm', 0)}
                return
            `
        ]
    ),

    [node.args.typeArguments.length]: coldFloatInletWithSetter(state.funcSetDelay)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateMessageReceivers, 
    stateVariables, 
    generateDeclarations,
    dependencies: [
        pipeGlobalCode,
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
