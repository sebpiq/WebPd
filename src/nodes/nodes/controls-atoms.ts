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
import { Code, Func, Sequence, Class } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import {
    build,
    EMPTY_BUS_NAME,
    ControlsBaseNodeArguments,
    controlsCore,
} from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils, msgUtils } from '../global-code/core'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { VariableName } from '@webpd/compiler/src/ast/types'

export type _NodeImplementation = NodeImplementation<ControlsBaseNodeArguments>

// TODO : use standard "unsupported message" from compile-generateDeclarations
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<ControlsBaseNodeArguments> = {
    translateArgs: ({ args: [_, __, receive, send] }: PdJson.AtomNode) => ({
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
}

// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation = ({
    name,
    initValueCode,
    messageMatch,
}: {
    name: string,
    initValueCode: Code,
    messageMatch?: (messageName: VariableName) => Code
}): _NodeImplementation => {

    return {
        state: ({ ns, node: { args } }) => 
            Class(ns.State!, [
                Var('Message', 'value', initValueCode),
                Var('string', 'receiveBusName', `"${args.receiveBusName}"`),
                Var('string', 'sendBusName', `"${args.sendBusName}"`),
                Var('MessageHandler', 'messageReceiver', ns.defaultMessageHandler),
                Var('MessageHandler', 'messageSender', ns.defaultMessageHandler),
            ]),

        initialization: ({
            ns,
            state, 
            node: { args },
            snds,
        }) => ast`
            ${state}.messageReceiver = ${AnonFunc([Var('Message', 'm')])`
                ${ns.receiveMessage}(${state}, m)
            `}
            ${state}.messageSender = ${snds.$0}
            ${ns.setReceiveBusName}(${state}, "${args.receiveBusName}")
        `,

        messageReceivers: ({ ns, state }) => ({
            '0': AnonFunc([Var('Message', 'm')])`
                ${ns.receiveMessage}(${state}, m)
                return
            `,
        }),

        core: ({ ns }) => 
            Sequence([
                controlsCore(ns),

                Func(ns.receiveMessage, [
                    Var(ns.State!, 'state'),
                    Var('Message', 'm'),
                ], 'void')`
                    if (msg_isBang(m)) {
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, state.value)
                        }
                        return
                    
                    } else if (
                        msg_getTokenType(m, 0) === MSG_STRING_TOKEN
                        && msg_readStringToken(m, 0) === 'set'
                    ) {
                        ${ConstVar('Message', 'setMessage', 'msg_slice(m, 1, msg_getLength(m))')}
                        ${messageMatch ? 
                            `if (${messageMatch('setMessage')}) {`: null} 
                                state.value = setMessage    
                                return
                        ${messageMatch ? 
                            '}': null}
        
                    } else if (${ns.setSendReceiveFromMessage}(state, m) === true) {
                        return
                        
                    } ${messageMatch ? 
                        `else if (${messageMatch('m')}) {`: 
                        `else {`}
                    
                        state.value = m
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, state.value)
                        }
                        return
        
                    }
                `
            ]),

        dependencies: [
            bangUtils,
            messageBuses,
            msgUtils,
        ],
    }
}

const builders = {
    'floatatom': builder,
    'symbolatom': builder,
    'listbox': builder,
}

const nodeImplementations = {
    'floatatom': makeNodeImplementation({
        name: 'floatatom',
        initValueCode: `msg_floats([0])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_FLOAT_TOKEN])`
    }),
    'symbolatom': makeNodeImplementation({
        name: 'symbolatom',
        initValueCode: `msg_strings([''])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_STRING_TOKEN])`
    }),
    'listbox': makeNodeImplementation({
        name: 'listbox',
        initValueCode: `msg_bang()`,
    })
}

export { builders, nodeImplementations, ControlsBaseNodeArguments as NodeArguments }
