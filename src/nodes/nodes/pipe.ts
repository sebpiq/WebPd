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

import { coreCode, functional } from '@webpd/compiler'
import { NodeImplementation, GlobalCodeDefinition } from '@webpd/compiler/src/types'
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
        isPullingSignal: true,
    }),
}

// ------------------------------- globalCode ------------------------------ //
const pipeGlobalCode: GlobalCodeDefinition = ({ macros: { Var }}) => `
    class pipe_ScheduledMessage {
        ${Var('message', 'Message')}
        ${Var('frame', 'Int')}
        ${Var('skedId', 'SkedId')}
    }
`

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    globs,
    snds,
    node: { args },
    macros: { Var, Func },
}) => functional.renderCode`
    let ${state.delay} = 0
    const ${Var(state.outputMessages, 'Array<Message>')} = [${
        args.typeArguments
            .map(([_, value]) => typeof value === 'number' ? 
                `msg_floats([${value}])`
                : `msg_strings(["${value}"])`).join(',')
    }]
    let ${Var(state.scheduledMessages, 'Array<pipe_ScheduledMessage>')} = []

    const ${state.funcScheduleMessage} = ${Func([
        Var('inMessage', 'Message')
    ], 'void')} => {
        let ${Var('insertIndex', 'Int')} = 0
        let ${Var('frame', 'Int')} = ${globs.frame} + ${state.delay}
        let ${Var('skedId', 'SkedId')} = SKED_ID_NULL
        let ${Var('scheduledMessage', 'pipe_ScheduledMessage')} = {
            message: msg_create([]),
            frame: frame,
            skedId: SKED_ID_NULL,
        }

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
    }

    const ${state.funcSendMessages} = ${Func([Var('toFrame', 'Int')], 'void')} => {
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
    }

    const ${state.funcWaitFrameCallback} = ${Func([
        Var('event', 'SkedEvent')
    ], 'void')} => {
        ${state.funcSendMessages}(${globs.frame})
    }

    const ${state.funcClear} = ${Func([], 'void')} => {
        let ${Var('i', 'Int')} = 0
        const ${Var('length', 'Int')} = ${state.scheduledMessages}.length
        for (i; i < length; i++) {
            commons_cancelWaitFrame(${state.scheduledMessages}[i].skedId)
        }
        ${state.scheduledMessages} = []
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

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ node, snds, globs, state }) => ({
    '0': functional.renderCode`
    if (msg_isBang(${globs.m})) {
        ${state.funcScheduleMessage}(msg_create([]))
        return

    } else if (msg_isAction(${globs.m}, 'clear')) {
        ${state.funcClear}()
        return 

    } else if (msg_isAction(${globs.m}, 'flush')) {
        if (${state.scheduledMessages}.length) {
            ${state.funcSendMessages}(${state.scheduledMessages}[${state.scheduledMessages}.length - 1].frame)
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
            `${state.outputMessages}[${i + 1}] = ${renderMessageTransfer(typeArg, globs.m, 0)}
            return`
        ]
    ),

    [node.args.typeArguments.length]: coldFloatInletWithSetter(globs.m, state.funcSetDelay)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages, 
    stateVariables, 
    declare,
    globalCode: [
        pipeGlobalCode,
        messageTokenToFloat, 
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
        coreCode.commonsWaitEngineConfigure,
        coreCode.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
