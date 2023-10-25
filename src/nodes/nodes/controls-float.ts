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
import { stdlib, functional } from '@webpd/compiler'
import {
    Code,
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertNumber, assertOptionalString } from '../validation'
import { build, declareControlSendReceive, EMPTY_BUS_NAME, messageSetSendReceive, ControlsBaseNodeArguments, stateVariables } from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'

interface NodeArguments extends ControlsBaseNodeArguments {
    minValue: number
    maxValue: number
    initValue: number
    outputOnLoad: boolean
}

export type _NodeBuilder = NodeBuilder<NodeArguments>

export type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

const makeNodeImplementation = ({
    prepareStoreValue,
    prepareStoreValueBang,
}: {
    prepareStoreValue?: (args: NodeArguments) => Code
    prepareStoreValueBang?: (args: NodeArguments) => Code
}): _NodeImplementation => {

    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations: _NodeImplementation['generateDeclarations'] = (context) => {
        const { 
            node, 
            state,
            snds,
            node: { id, args },
            compilation: { codeVariableNames: { nodes } },
            macros: { Var, Func }
        } = context
        return `
            let ${Var(state.value, 'Float')} = ${node.args.initValue}

            ${functional.renderIf(
                prepareStoreValue, 
                () => `function ${state.funcPrepareStoreValue} ${Func([
                    Var('value', 'Float')
                ], 'Float')} {
                    return ${prepareStoreValue(node.args)}
                }`
            )}

            ${functional.renderIf(
                prepareStoreValueBang, 
                () => `function ${state.funcPrepareStoreValueBang} ${Func([
                    Var('value', 'Float')
                ], 'Float')} {
                    return ${prepareStoreValueBang(node.args)}
                }`
            )}

            function ${state.funcMessageReceiver} ${Func([
                Var('m', 'Message'),
            ], 'void')} {
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${prepareStoreValue ? 
                        `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 0))`
                        : `${state.value} = msg_readFloatToken(m, 0)`}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (msg_isBang(m)) {
                    ${functional.renderIf(
                        prepareStoreValueBang, 
                        () => `${state.value} = ${state.funcPrepareStoreValueBang}(${state.value})`
                    )}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (
                    msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                    && msg_readStringToken(m, 0) === 'set'
                ) {
                    ${prepareStoreValue ? 
                        `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 1))`
                        : `${state.value} = msg_readFloatToken(m, 1)`}
                }
            
                ${messageSetSendReceive(context)}
            }

            ${declareControlSendReceive(context)}

            ${functional.renderIf(
                args.outputOnLoad, 
                `commons_waitFrame(0, () => ${snds.$0}(msg_floats([${state.value}])))`
            )}
        `
    }

    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = (context) => {
        const { globs, state } = context
        return {
            '0': `
                ${state.funcMessageReceiver}(${globs.m})
                return
            `
        }
    }

    return {
        generateMessageReceivers,
        generateDeclarations,
        stateVariables,
        dependencies: [
            bangUtils,
            messageBuses,
            stdlib.commonsWaitEngineConfigure,
            stdlib.commonsWaitFrame,
        ],
    }
}
// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'tgl': makeNodeImplementation({
        prepareStoreValueBang: ({ maxValue }) =>
            `value === 0 ? ${maxValue}: 0`
    }),
    'nbx': makeNodeImplementation({
        prepareStoreValue: ({ minValue, maxValue }) => 
            `Math.min(Math.max(value,${minValue}),${maxValue})`
    }),
    'hsl': makeNodeImplementation({}),
    'hradio': makeNodeImplementation({}),
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
