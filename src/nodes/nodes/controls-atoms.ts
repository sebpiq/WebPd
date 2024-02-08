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
import { Code, stdlib, Func, Sequence, Class } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import {
    build,
    EMPTY_BUS_NAME,
    ControlsBaseNodeArguments,
    controlsCore,
    controlsCoreVariableNamesList,
} from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils, msgUtils } from '../global-code/core'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { VariableName } from '@webpd/compiler/src/ast/types'
import { generateVariableNamesNodeType } from '../variable-names'

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

    const variableNames = generateVariableNamesNodeType(name, [
        ...controlsCoreVariableNamesList,
        'receiveMessage',
    ])

    return {
        state: ({ node: { args }, stateClassName }) => 
            Class(stateClassName, [
                Var('Message', 'value', initValueCode),
                Var('string', 'receiveBusName', `"${args.receiveBusName}"`),
                Var('string', 'sendBusName', `"${args.sendBusName}"`),
                Var('MessageHandler', 'messageReceiver', variableNames.defaultMessageHandler),
                Var('MessageHandler', 'messageSender', variableNames.defaultMessageHandler),
            ]),

        initialization: ({
            state, 
            node: { args },
            snds,
        }) => ast`
            ${state}.messageReceiver = ${AnonFunc([Var('Message', 'm')])`
                ${variableNames.receiveMessage}(${state}, m)
            `}
            ${state}.messageSender = ${snds.$0}
            ${variableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
        `,

        messageReceivers: ({ state }) => ({
            '0': AnonFunc([Var('Message', 'm')])`
                ${variableNames.receiveMessage}(${state}, m)
                return
            `,
        }),

        core: ({ stateClassName }) => 
            Sequence([
                controlsCore(variableNames, stateClassName),

                Func(variableNames.receiveMessage, [
                    Var(stateClassName, 'state'),
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
        
                    } else if (${variableNames.setSendReceiveFromMessage}(state, m) === true) {
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
