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
import { NodeBuilder } from '../../compile-dsp-graph/types'
import {
    Func,
    Sequence,
    Var,
    VariableNamesIndex,
    AstElement,
    VariableName,
} from '@webpd/compiler'

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

export const controlsCore = (
    ns: { [name: string]: VariableName },
    { msg, msgBuses }: VariableNamesIndex['globals']
): AstElement =>
    Sequence([
        Func(ns.setReceiveBusName, [
            Var(ns.State, `state`),
            Var(`string`, `busName`),
        ], 'void')`
            if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
                ${msgBuses.unsubscribe}(state.receiveBusName, state.messageReceiver)
            }
            state.receiveBusName = busName
            if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
                ${msgBuses.subscribe}(state.receiveBusName, state.messageReceiver)
            }
        `,

        Func(ns.setSendReceiveFromMessage, [
            Var(ns.State, `state`),
            Var(msg.Message, `m`),
        ], 'boolean')`
            if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'receive'
            ) {
                ${ns.setReceiveBusName}(state, ${msg.readStringToken}(m, 1))
                return true

            } else if (
                ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(m, 0) === 'send'
            ) {
                state.sendBusName = ${msg.readStringToken}(m, 1)
                return true
            }
            return false
        `,

        Func(ns.defaultMessageHandler, [Var(msg.Message, `m`)], `void`)``,
    ])