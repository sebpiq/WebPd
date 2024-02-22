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
import { stdlib, Func, Sequence, Class, AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { build, EMPTY_BUS_NAME, ControlsBaseNodeArguments, controlsCore } from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'

interface NodeArguments extends ControlsBaseNodeArguments {
    outputOnLoad: boolean
}

export type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args: [init, receive, send] }: PdJson.BangNode) => ({
        outputOnLoad: !!init,
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    state: ({ ns, node: { args } }) => 
        Class(ns.State!, [
            Var('Message', 'value', 'msg_create([])'),
            Var('string', 'receiveBusName', `"${args.receiveBusName}"`),
            Var('string', 'sendBusName', `"${args.sendBusName}"`),
            Var('MessageHandler', 'messageReceiver', ns.defaultMessageHandler!),
            Var('MessageHandler', 'messageSender', ns.defaultMessageHandler!),
        ]),

    initialization: ({ 
        ns,
        snds,
        state,
        node: { args },
    }) => ast`
        ${state}.messageReceiver = ${AnonFunc([Var('Message', 'm')])`
            ${ns.receiveMessage!}(${state}, m)
        `}
        ${state}.messageSender = ${snds.$0}
        ${ns.setReceiveBusName!}(${state}, "${args.receiveBusName}")

        ${args.outputOnLoad ? 
            `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`: null}
    `,
    
    messageReceivers: ({ ns, state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            ${ns.receiveMessage!}(${state}, m)
            return
        `,
    }),

    core: ({ ns }) => 
        Sequence([
            controlsCore(ns),

            Func(ns.receiveMessage!, [
                Var(ns.State!, 'state'),
                Var('Message', 'm'),
            ], 'void')`
                if (${ns.setSendReceiveFromMessage!}(state, m) === true) {
                    return
                }
                
                ${ConstVar('Message', 'outMessage', 'msg_bang()')}
                state.messageSender(outMessage)
                if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                    msgBusPublish(state.sendBusName, outMessage)
                }
                return
            `
        ]),

    dependencies: [
        bangUtils,
        messageBuses,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
