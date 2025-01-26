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
import {
    stdlib,
    Func,
    Sequence,
    Class,
    AnonFunc,
    ConstVar,
    Var,
    ast,
    NodeImplementation,
} from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { build, EMPTY_BUS_NAME, ControlsBaseNodeArguments, controlsCore } from './controls-base'
import { msgBuses } from '../global-code/buses'
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
// prettier-ignore
const nodeImplementation: _NodeImplementation = {
    state: ({ ns, node: { args } }, { msg }) => 
        Class(ns.State, [
            Var(msg.Message, `value`, `${msg.create}([])`),
            Var(`string`, `receiveBusName`, `"${args.receiveBusName}"`),
            Var(`string`, `sendBusName`, `"${args.sendBusName}"`),
            Var(msg.Handler, `messageReceiver`, ns.defaultMessageHandler),
            Var(msg.Handler, `messageSender`, ns.defaultMessageHandler),
        ]),

    initialization: (
        { 
            ns,
            snds,
            state,
            node: { args },
        },
        { commons, msg, bangUtils }
    ) => ast`
        ${state}.messageReceiver = ${AnonFunc([Var(msg.Message, `m`)])`
            ${ns.receiveMessage}(${state}, m)
        `}
        ${state}.messageSender = ${snds.$0}
        ${ns.setReceiveBusName}(${state}, "${args.receiveBusName}")

        ${args.outputOnLoad ? 
            `${commons.waitFrame}(0, () => ${snds.$0}(${bangUtils.bang}()))`: null}
    `,
    
    messageReceivers: ({ ns, state }, { msg }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            ${ns.receiveMessage}(${state}, m)
            return
        `,
    }),

    core: ({ ns }, globals) => {
        const { msg, msgBuses, bangUtils } = globals
        return Sequence([
            controlsCore(ns, globals),

            Func(ns.receiveMessage, [
                Var(ns.State, `state`),
                Var(msg.Message, `m`),
            ], 'void')`
                if (${ns.setSendReceiveFromMessage}(state, m) === true) {
                    return
                }
                
                ${ConstVar(msg.Message, `outMessage`, `${bangUtils.bang}()`)}
                state.messageSender(outMessage)
                if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                    ${msgBuses.publish}(state.sendBusName, outMessage)
                }
                return
            `
        ])
    },

    dependencies: [
        bangUtils,
        msgBuses,
        stdlib.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
