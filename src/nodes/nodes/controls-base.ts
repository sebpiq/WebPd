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
import { GlobalCodeGenerator } from "@webpd/compiler/src/compile/types"
import { NodeBuilder } from "../../compile-dsp-graph/types"
import { Class, Func, Sequence, Var } from "@webpd/compiler"
import { generateVariableNamesNodeType } from "../variable-names"

export const EMPTY_BUS_NAME = 'empty'

export interface ControlsBaseNodeArguments {
    receiveBusName: string
    sendBusName: string
}

export const build: NodeBuilder<any>['build'] = () => ({
    inlets: {
        '0': { type: 'message', id: '0' },
    },
    outlets: {
        '0': { type: 'message', id: '0' },
    },
    // This is always true, because the object can receive 
    // messages through message bus
    isPushingMessages: true
})

// TODO : move to global code
export const controlsCoreVariableNames = generateVariableNamesNodeType('control', [
    'setReceiveBusName', 
    'setSendReceiveFromMessage',
    'defaultMessageHandler',
])

export const controlsCore: GlobalCodeGenerator = () => Sequence([
    Class(controlsCoreVariableNames.stateClass, [
        Var('Float', 'minValue'),
        Var('Float', 'maxValue'),
        Var('Float', 'valueFloat'),
        Var('Message', 'value'),
        Var('string', 'receiveBusName'),
        Var('string', 'sendBusName'),
        Var('(m: Message) => void', 'messageReceiver'),
        Var('(m: Message) => void', 'messageSender'),
    ]),

    Func(controlsCoreVariableNames.setReceiveBusName, [
        Var(controlsCoreVariableNames.stateClass, 'state'),
        Var('string', 'busName'),
    ], 'void')`
        if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
            msgBusUnsubscribe(state.receiveBusName, state.messageReceiver)
        }
        state.receiveBusName = busName
        if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
            msgBusSubscribe(state.receiveBusName, state.messageReceiver)
        }
    `,

    Func(controlsCoreVariableNames.setSendReceiveFromMessage, [
        Var(controlsCoreVariableNames.stateClass, 'state'),
        Var('Message', 'm'),
    ], 'boolean')`
        if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'receive'
        ) {
            ${controlsCoreVariableNames.setReceiveBusName}(state, msg_readStringToken(m, 1))
            return true

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'send'
        ) {
            state.sendBusName = msg_readStringToken(m, 1)
            return true
        }
        return false
    `,

    Func(controlsCoreVariableNames.defaultMessageHandler, [Var('Message', 'm')], 'void')``,
])