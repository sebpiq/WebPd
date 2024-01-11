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
import { stdlib, Func, Sequence } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { build, EMPTY_BUS_NAME, ControlsBaseNodeArguments, controlsCoreVariableNames, controlsCore } from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments extends ControlsBaseNodeArguments {
    outputOnLoad: boolean
}

export type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args: [init, receive, send] }: PdJson.BangNode) => ({
        outputOnLoad: !!init,
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
}

// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('bang', ['receiveMessage'])

const nodeImplementation: _NodeImplementation = {
    stateInitialization: ({ node: { args }}) => 
        Var(controlsCoreVariableNames.stateClass, '', `{
            value: msg_create([]),
            receiveBusName: "${args.receiveBusName}",
            sendBusName: "${args.sendBusName}",
            messageReceiver: ${controlsCoreVariableNames.defaultMessageHandler},
            messageSender: ${controlsCoreVariableNames.defaultMessageHandler},
        }`),

    initialization: ({ 
        snds,
        state,
        node: { args },
    }) => ast`
        commons_waitEngineConfigure(() => {
            ${state}.messageReceiver = ${AnonFunc([Var('Message', 'm')])`
                ${variableNames.receiveMessage}(${state}, m)
            `}
            ${state}.messageSender = ${snds.$0}
            ${controlsCoreVariableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
        })

        ${args.outputOnLoad ? 
            `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`: null}
    `,
    
    messageReceivers: ({ state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            ${variableNames.receiveMessage}(${state}, m)
            return
        `,
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
                if (${controlsCoreVariableNames.setSendReceiveFromMessage}(state, m) === true) {
                    return
                }
                
                ${ConstVar('Message', 'outMessage', 'msg_bang()')}
                state.messageSender(outMessage)
                if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                    msgBusPublish(state.sendBusName, outMessage)
                }
                return
            `
        ]),
    ],
}

export { builder, nodeImplementation, NodeArguments }
