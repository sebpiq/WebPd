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
import { Func, Sequence, Var } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { AstElement, VariableName } from '@webpd/compiler/src/ast/types'

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

export const controlsCoreVariableNamesList = [
    'setReceiveBusName', 
    'setSendReceiveFromMessage',
    'defaultMessageHandler',
]

export const controlsCore = (
    variableNames: ReturnType<typeof generateVariableNamesNodeType>, 
    stateClassName: VariableName,
): AstElement =>
    Sequence([
        Func(variableNames.setReceiveBusName, [
            Var(stateClassName, 'state'),
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

        Func(variableNames.setSendReceiveFromMessage, [
            Var(stateClassName, 'state'),
            Var('Message', 'm'),
        ], 'boolean')`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'receive'
            ) {
                ${variableNames.setReceiveBusName}(state, msg_readStringToken(m, 1))
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

        Func(variableNames.defaultMessageHandler, [Var('Message', 'm')], 'void')``,
    ])