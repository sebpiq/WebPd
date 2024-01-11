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
    controlsCoreVariableNames,
    controlsCore,
} from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'
import { generateVariableNamesNodeType } from '../variable-names'

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

    const variableNames = generateVariableNamesNodeType(name, ['receiveMessage'])

    return {
        stateInitialization: ({ node: { args }}) => 
            Var(controlsCoreVariableNames.stateClass, '', `{
                minValue: ${args.minValue},
                maxValue: ${args.maxValue},
                valueFloat: ${args.initValue},
                value: msg_create([]),
                receiveBusName: "${args.receiveBusName}",
                sendBusName: "${args.sendBusName}",
                messageReceiver: ${controlsCoreVariableNames.defaultMessageHandler},
                messageSender: ${controlsCoreVariableNames.defaultMessageHandler},
            }`),

        initialization: ({
            state,
            snds,
            node: { args },
        }) =>
            // There is a circular dependency problem between the state and snds.$0 so we can actually
            // only use snds.$0 inside the callback of `commons_waitEngineConfigure`.
            // TODO : assemblyscript-upgrade - this is probably no true anymore.
            ast`    
                commons_waitEngineConfigure(() => {
                    ${state}.messageReceiver = ${AnonFunc([Var('Message', 'm')])`
                        ${variableNames.receiveMessage}(${state}, m)
                    `}
                    ${state}.messageSender = ${snds.$0}
                    ${controlsCoreVariableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
                })
    
                ${args.outputOnLoad ? 
                    `commons_waitFrame(0, () => ${snds.$0}(msg_floats([${state}.valueFloat])))`: null}
            `,
        
        messageReceivers: ({ 
            state, 
        }) => ({
            '0': AnonFunc([Var('Message', 'm')])`
                ${variableNames.receiveMessage}(${state}, m)
                return
            `
        }),

        dependencies: [
            bangUtils,
            messageBuses,
            stdlib.commonsWaitEngineConfigure,
            stdlib.commonsWaitFrame,
            controlsCore,
            () => Sequence([
                Func(variableNames.receiveMessage, [
                    Var(controlsCoreVariableNames.stateClass, 'state'),
                    Var('Message', 'm'),
                ], 'void')`
                    if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                        ${prepareStoreValue ? 
                            `state.valueFloat = ${prepareStoreValue(`msg_readFloatToken(m, 0)`)}`
                            : `state.valueFloat = msg_readFloatToken(m, 0)`}
                        ${ConstVar('Message', 'outMessage', `msg_floats([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (msg_isBang(m)) {
                        ${prepareStoreValueBang ? 
                            `state.valueFloat = ${prepareStoreValueBang(`state.valueFloat`)}`
                        : null}
                        ${ConstVar('Message', 'outMessage', `msg_floats([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (
                        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                        && msg_readStringToken(m, 0) === 'set'
                    ) {
                        ${prepareStoreValue ? 
                            `state.valueFloat = ${prepareStoreValue(`msg_readFloatToken(m, 1)`)}`
                            : `state.valueFloat = msg_readFloatToken(m, 1)`}
                        return
                    
                    } else if (${controlsCoreVariableNames.setSendReceiveFromMessage}(state, m) === true) {
                        return
                    }
                `
            ]),
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
    'hsl': makeNodeImplementation({ name: 'sl' }),
    'hradio': makeNodeImplementation({ name: 'radio' }),
}
nodeImplementations['vsl'] = nodeImplementations['hsl']
nodeImplementations['vradio'] = nodeImplementations['hradio']

const builders = {
    'tgl': builderWithoutMin,
    'nbx': builderWithInit,
    'hsl': builderWithInit,
    'vsl': builderWithInit,
    'hradio': builderWithoutMin,
    'vradio': builderWithoutMin,
}

export { builders, nodeImplementations, NodeArguments }
