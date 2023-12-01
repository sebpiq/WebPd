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

import { stdlib, functional, Sequence } from '@webpd/compiler'
import { NodeImplementation, GlobalCodeGenerator } from '@webpd/compiler/src/compile/types'
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
import { AnonFunc, Class, ConstVar, Func, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    typeArguments: Array<[TypeArgument, number | string]>
    delay: number
}

type _NodeImplementation = NodeImplementation<NodeArguments>

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

// ------------------------------- generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('pipe', [
    'prepareMessageScheduling',
    'sendMessages',
    'clear',
    'setDelay',
    'ScheduledMessage',
    'dummyScheduledMessage',
])

const nodeCore: GlobalCodeGenerator = ({ globs }) => Sequence([
    Class(variableNames.stateClass, [
        Var('Int', 'delay'),
        Var('Array<Message>', 'outputMessages'),
        Var(`Array<${variableNames.ScheduledMessage}>`, 'scheduledMessages'),
        Var('Array<(m: Message) => void>', 'snds'),
    ]),

    Class(variableNames.ScheduledMessage, [
        Var('Message', 'message'), 
        Var('Int', 'frame'), 
        Var('SkedId', 'skedId'), 
    ]),

    ConstVar(variableNames.ScheduledMessage, variableNames.dummyScheduledMessage, `{
        message: msg_create([]),
        frame: 0,
        skedId: SKED_ID_NULL,
    }`),

    Func(variableNames.prepareMessageScheduling, [
        Var(variableNames.stateClass, 'state'),
        Var('SkedCallback', 'callback'),
    ], 'Int')`
        ${Var('Int', 'insertIndex', '0')}
        ${Var('Int', 'frame', `${globs.frame} + state.delay`)}
        ${Var('SkedId', 'skedId', 'SKED_ID_NULL')}

        while (
            insertIndex < state.scheduledMessages.length 
            && state.scheduledMessages[insertIndex].frame <= frame
        ) {
            insertIndex++
        }

        ${''
        // If there was not yet a callback scheduled for that frame, we schedule it.
        }
        if (
            insertIndex === 0 || 
            (
                insertIndex > 0 
                && state.scheduledMessages[insertIndex - 1].frame !== frame
            )
        ) {
            skedId = commons_waitFrame(frame, callback)
        }

        ${''
        // !!! Array.splice insertion is not supported by assemblyscript, so : 
        // 1. We grow arrays to their post-insertion size by using `push`
        // 2. We use `copyWithin` to move old elements to their final position.
        // 3. Instantiate new messages in the newly created holes.
        }
        for (${Var('Int', 'i', 0)}; i < state.snds.length; i++) {
            state.scheduledMessages.push(${variableNames.dummyScheduledMessage})
        }
        state.scheduledMessages.copyWithin(
            (insertIndex + 1) * state.snds.length, 
            insertIndex * state.snds.length
        )
        for (${Var('Int', 'i', 0)}; i < state.snds.length; i++) {
            state.scheduledMessages[insertIndex + i] = {
                message: ${variableNames.dummyScheduledMessage}.message,
                frame,
                skedId,
            }
        }

        return insertIndex
    `,

    Func(variableNames.sendMessages, [
        Var(variableNames.stateClass, 'state'),
        Var('Int', 'toFrame'),
    ], 'void')`
        ${Var('Int', 'i', 0)}
        while (
            state.scheduledMessages.length 
            && state.scheduledMessages[0].frame <= toFrame
        ) {
            for (i = 0; i < state.snds.length; i++) {
                // Snds are already reversed
                state.snds[i](state.scheduledMessages.shift().message)
            }
        }
    `,

    Func(variableNames.clear, [
        Var(variableNames.stateClass, 'state'),
    ], 'void')`
        ${Var('Int', 'i', '0')}
        ${ConstVar('Int', 'length', `state.scheduledMessages.length`)}
        for (i; i < length; i++) {
            commons_cancelWaitFrame(state.scheduledMessages[i].skedId)
        }
        state.scheduledMessages = []
    `,

    Func(variableNames.setDelay, [
        Var(variableNames.stateClass, 'state'),
        Var('Float', 'delay'),
    ], 'void')`
        state.delay = toInt(Math.round(delay / 1000 * ${globs.sampleRate}))
    `,
])

const initialization: _NodeImplementation['initialization'] = ({ node: { args, id }, state, snds }) => 
    ast`
        ${ConstVar(variableNames.stateClass, state, `{
            delay: 0,
            outputMessages: [${
                args.typeArguments
                    .map(([_, value]) => typeof value === 'number' ? 
                        `msg_floats([${value}])`
                        : `msg_strings(["${value}"])`).join(',')
            }],
            scheduledMessages: [],
            snds: [${functional.countTo(args.typeArguments.length)
                    .reverse()
                    .map((i) => snds[i]).join(', ')
            }],
        }`)}

        commons_waitEngineConfigure(() => {
            ${variableNames.setDelay}(${state}, ${args.delay})
        })
    `

// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers: _NodeImplementation['messageReceivers'] = ({ 
    node: { args }, 
    state, 
    globs,
}) => ({
    '0': AnonFunc([Var('Message', 'm')])`
        if (msg_isAction(m, 'clear')) {
            ${variableNames.clear}(${state})
            return 

        } else if (msg_isAction(m, 'flush')) {
            if (${state}.scheduledMessages.length) {
                ${variableNames.sendMessages}(
                    ${state}, 
                    ${state}.scheduledMessages[${state}.scheduledMessages.length - 1].frame
                )
            }
            return

        } else {
            ${ConstVar('Message', 'inMessage', 'msg_isBang(m) ? msg_create([]): m')}
            ${ConstVar('Int', 'insertIndex', `${variableNames.prepareMessageScheduling}(
                ${state}, 
                () => {
                    ${variableNames.sendMessages}(${state}, ${globs.frame})
                },
            )`)}

            ${args.typeArguments.slice(0).reverse()
                .map<[number, TypeArgument]>(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
                .map(([iReverse, typeArg], i) => 
                    ast`
                        if (msg_getLength(inMessage) > ${iReverse}) {
                            ${state}.scheduledMessages[insertIndex + ${i}].message = 
                                ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                            ${state}.outputMessages[${iReverse}] 
                                = ${state}.scheduledMessages[insertIndex + ${i}].message
                        } else {
                            ${state}.scheduledMessages[insertIndex + ${i}].message 
                                = ${state}.outputMessages[${iReverse}]
                        }
                    `
                )
            }

            return
        }
    `,

    ...functional.mapArray(
        args.typeArguments.slice(1), 
        ([typeArg], i) => [
            `${i + 1}`, 
            AnonFunc([Var('Message', 'm')])`
                ${state}.outputMessages[${i + 1}] = ${renderMessageTransfer(typeArg, 'm', 0)}
                return
            `
        ]
    ),

    [args.typeArguments.length]: coldFloatInletWithSetter(variableNames.setDelay, state)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messageReceivers: messageReceivers,
    initialization: initialization,
    dependencies: [
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
        stdlib.commonsWaitEngineConfigure,
        stdlib.commonsWaitFrame,
        nodeCore,
    ],
}

export { builder, nodeImplementation, NodeArguments }
