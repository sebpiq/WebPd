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
import { Code, Func, Sequence, Class, AnonFunc, ConstVar, Var, ast, VariableNamesIndex } from '@webpd/compiler'
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
import { msgBuses } from '../global-code/buses'
import { bangUtils, msgUtils } from '../global-code/core'
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
    name: string
    initValueCode: (globals: VariableNamesIndex['globals']) => Code,
    messageMatch?: (messageName: VariableName, globals: VariableNamesIndex['globals']) => Code
}): _NodeImplementation => {

    return {
        flags: {
            alphaName: name,
        },

        state: ({ ns, node: { args } }, globals) => {
            const { msg } = globals
            return Class(ns.State, [
                Var(msg.Message, `value`, initValueCode(globals)),
                Var(`string`, `receiveBusName`, `"${args.receiveBusName}"`),
                Var(`string`, `sendBusName`, `"${args.sendBusName}"`),
                Var(msg.Handler, `messageReceiver`, ns.defaultMessageHandler),
                Var(msg.Handler, `messageSender`, ns.defaultMessageHandler),
            ])
        },

        initialization: (
            {
                ns,
                state, 
                node: { args },
                snds,
            }, 
            { msg }
        ) => ast`
            ${state}.messageReceiver = ${AnonFunc([Var(msg.Message, `m`)])`
                ${ns.receiveMessage}(${state}, m)
            `}
            ${state}.messageSender = ${snds.$0}
            ${ns.setReceiveBusName}(${state}, "${args.receiveBusName}")
        `,

        messageReceivers: ({ ns, state }, { msg }) => ({
            '0': AnonFunc([Var(msg.Message, `m`)])`
                ${ns.receiveMessage}(${state}, m)
                return
            `,
        }),

        core: ({ ns }, globals) => {
            const { msg, msgBuses, bangUtils, msgUtils } = globals
            return Sequence([
                controlsCore(ns, globals),

                Func(ns.receiveMessage, [
                    Var(ns.State, `state`),
                    Var(msg.Message, `m`),
                ], 'void')`
                    if (${bangUtils.isBang}(m)) {
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            ${msgBuses.publish}(state.sendBusName, state.value)
                        }
                        return
                    
                    } else if (
                        ${msg.getTokenType}(m, 0) === ${msg.STRING_TOKEN}
                        && ${msg.readStringToken}(m, 0) === 'set'
                    ) {
                        ${ConstVar(msg.Message, `setMessage`, `${msgUtils.slice}(m, 1, ${msg.getLength}(m))`)}
                        ${messageMatch ? 
                            `if (${messageMatch('setMessage', globals)}) {`: null} 
                                state.value = setMessage    
                                return
                        ${messageMatch ? 
                            '}': null}
        
                    } else if (${ns.setSendReceiveFromMessage}(state, m) === true) {
                        return
                        
                    } ${messageMatch ? 
                        `else if (${messageMatch('m', globals)}) {`: 
                        `else {`}
                    
                        state.value = m
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            ${msgBuses.publish}(state.sendBusName, state.value)
                        }
                        return
        
                    }
                `
            ])
        },

        dependencies: [
            bangUtils,
            msgBuses,
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
        initValueCode: ({ msg }) => `${msg.floats}([0])`,
        messageMatch: (m, { msg }) => `${msg.isMatching}(${m}, [${msg.FLOAT_TOKEN}])`
    }),
    'symbolatom': makeNodeImplementation({
        name: 'symbolatom',
        initValueCode: ({ msg }) => `${msg.strings}([''])`,
        messageMatch: (m, { msg }) => `${msg.isMatching}(${m}, [${msg.STRING_TOKEN}])`
    }),
    'listbox': makeNodeImplementation({
        name: 'listbox',
        initValueCode: ({ bangUtils }) => `${bangUtils.bang}()`,
    })
}

export { builders, nodeImplementations, ControlsBaseNodeArguments as NodeArguments }
