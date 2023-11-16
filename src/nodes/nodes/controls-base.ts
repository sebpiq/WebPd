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
import { NodeImplementation } from "@webpd/compiler/src/compile/types"
import { NodeBuilder } from "../../compile-dsp-graph/types"
import { Func, Var, ast } from "@webpd/compiler/src/ast/declare"
import { Code } from "@webpd/compiler"

export const EMPTY_BUS_NAME = 'empty'

export interface ControlsBaseNodeArguments {
    receiveBusName: string
    sendBusName: string
}

export const stateVariables = {
    value: 1,
    funcPrepareStoreValue: 1,
    funcPrepareStoreValueBang: 1,
    funcSetReceiveBusName: 1,
    sendBusName: 1,
    receiveBusName: 1,
    funcMessageReceiver: 1,
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

export const declareControlSendReceive: NodeImplementation<any>['generateDeclarations'] = ({ 
    node, 
    state, 
    node: { args },
}) => ast`
    ${Var('string', state.receiveBusName, `"${node.args.receiveBusName}"`)}
    ${Var('string', state.sendBusName, `"${node.args.sendBusName}"`)}

    ${Func(state.funcSetReceiveBusName, [
        Var('string', 'busName')
    ], 'void')`
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusUnsubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
        ${state.receiveBusName} = busName
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusSubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
    `}

    commons_waitEngineConfigure(() => {
        ${state.funcSetReceiveBusName}("${args.receiveBusName}")
    })
`

export const messageSetSendReceive: (
    context: Parameters<NodeImplementation<any>['generateDeclarations']>[0]
) => Code = ({ state }) => `
    if (
        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(m, 0) === 'receive'
    ) {
        ${state.funcSetReceiveBusName}(msg_readStringToken(m, 1))
        return

    } else if (
        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(m, 0) === 'send'
    ) {
        ${state.sendBusName} = msg_readStringToken(m, 1)
        return
    }
`