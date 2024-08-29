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
    Code,
    Sequence,
    AnonFunc,
    ConstVar,
    Var,
    ast,
    Func,
    Class,
} from '@webpd/compiler'
import {
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertNumber, assertOptionalString } from '../validation'
import {
    build,
    EMPTY_BUS_NAME,
    ControlsBaseNodeArguments,
    controlsCore,
} from './controls-base'
import { msgBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'

interface NodeArguments extends ControlsBaseNodeArguments {
    minValue: number
    maxValue: number
    initValue: number
    outputOnLoad: boolean
}

export type _NodeBuilder = NodeBuilder<NodeArguments>

export type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builderWithInit: _NodeBuilder = {
    translateArgs: ({
        args: [minValue, maxValue, init, initValue, receive, send],
    }: PdJson.SliderNode | PdJson.NumberBoxNode) => ({
        minValue: assertNumber(minValue),
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
}

const builderWithoutMin: _NodeBuilder = {
    translateArgs: ({
        args: [maxValue, init, initValue, receive, send],
    }: PdJson.ToggleNode | PdJson.RadioNode) => ({
        minValue: 0,
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
}

// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation = ({
    prepareStoreValue,
    prepareStoreValueBang,
    name
}: {
    prepareStoreValue?: (valueCode: Code) => Code
    prepareStoreValueBang?: (valueCode: Code) => Code
    name: string
}): _NodeImplementation => {

    return {
        flags: {
            alphaName: name,
        },

        state: ({ ns, node: { args } }, { msg }) => 
            Class(ns.State, [
                Var(`Float`, `minValue`, args.minValue),
                Var(`Float`, `maxValue`, args.maxValue),
                Var(`Float`, `valueFloat`, args.initValue),
                Var(msg.Message, `value`, `${msg.create}([])`),
                Var(`string`, `receiveBusName`, `"${args.receiveBusName}"`),
                Var(`string`, `sendBusName`, `"${args.sendBusName}"`),
                Var(msg.Handler, `messageReceiver`, ns.defaultMessageHandler),
                Var(msg.Handler, `messageSender`, ns.defaultMessageHandler),
            ]),

        initialization: (
            {
                ns,
                state,
                snds,
                node: { args },
            }, {
                commons, msg
            }
        ) =>
            ast`
                ${state}.messageSender = ${snds.$0}
                ${state}.messageReceiver = ${AnonFunc([Var(msg.Message, `m`)])`
                    ${ns.receiveMessage}(${state}, m)
                `}
                ${ns.setReceiveBusName}(${state}, "${args.receiveBusName}")
    
                ${args.outputOnLoad ? 
                    `${commons.waitFrame}(0, () => ${snds.$0}(${msg.floats}([${state}.valueFloat])))`: null}
            `,
        
        messageReceivers: (
            { 
                ns,
                state, 
            },
            { msg }
        ) => ({
            '0': AnonFunc([Var(msg.Message, `m`)])`
                ${ns.receiveMessage}(${state}, m)
                return
            `
        }),

        core: ({ ns }, globals) => {
            const { msgBuses, bangUtils, msg } = globals
            return Sequence([
                controlsCore(ns, globals),

                Func(ns.receiveMessage, [
                    Var(ns.State, `state`),
                    Var(msg.Message, `m`),
                ], 'void')`
                    if (${msg.isMatching}(m, [${msg.FLOAT_TOKEN}])) {
                        ${prepareStoreValue ? 
                            `state.valueFloat = ${prepareStoreValue(`${msg.readFloatToken}(m, 0)`)}`
                            : `state.valueFloat = ${msg.readFloatToken}(m, 0)`}
                        ${ConstVar(msg.Message, `outMessage`, `${msg.floats}([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            ${msgBuses.publish}(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (${bangUtils.isBang}(m)) {
                        ${prepareStoreValueBang ? 
                            `state.valueFloat = ${prepareStoreValueBang(`state.valueFloat`)}`
                        : null}
                        ${ConstVar(msg.Message, `outMessage`, `${msg.floats}([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            ${msgBuses.publish}(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (
                        ${msg.isMatching}(m, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}]) 
                        && ${msg.readStringToken}(m, 0) === 'set'
                    ) {
                        ${prepareStoreValue ? 
                            `state.valueFloat = ${prepareStoreValue(`${msg.readFloatToken}(m, 1)`)}`
                            : `state.valueFloat = ${msg.readFloatToken}(m, 1)`}
                        return
                    
                    } else if (${ns.setSendReceiveFromMessage}(state, m) === true) {
                        return
                    }
                `
            ])
        },

        dependencies: [
            bangUtils,
            msgBuses,
            stdlib.commonsWaitFrame,
        ],
    }
}
// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'tgl': makeNodeImplementation({
        name: 'tgl',
        prepareStoreValueBang: (valueCode) =>
            `${valueCode} === 0 ? state.maxValue: 0`
    }),
    'nbx': makeNodeImplementation({
        name: 'nbx',
        prepareStoreValue: (valueCode) => 
            `Math.min(Math.max(${valueCode},state.minValue),state.maxValue)`
    }),
    'hsl': makeNodeImplementation({ name: 'hsl' }),
    'vsl': makeNodeImplementation({ name: 'vsl' }),
    'hradio': makeNodeImplementation({ name: 'hradio' }),
    'vradio': makeNodeImplementation({ name: 'vradio' }),
}

const builders = {
    'tgl': builderWithoutMin,
    'nbx': builderWithInit,
    'hsl': builderWithInit,
    'vsl': builderWithInit,
    'hradio': builderWithoutMin,
    'vradio': builderWithoutMin,
}

export { builders, nodeImplementations, NodeArguments }
