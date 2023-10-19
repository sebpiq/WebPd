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
import { coreCode, functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { build, declareControlSendReceive, EMPTY_BUS_NAME, messageSetSendReceive, ControlsBaseNodeArguments, stateVariables } from './controls-base'
import { messageBuses } from '../global-code/buses'
import { bangUtils } from '../global-code/core'

interface NodeArguments extends ControlsBaseNodeArguments {
    outputOnLoad: boolean
}

export type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args: [init, receive, send] }: PdJson.BangNode) => ({
        outputOnLoad: !!init,
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = (context) => {
    const { 
        state,
        snds,
        node: { id, args },
        macros: { Var, Func },
        compilation: { codeVariableNames: { nodes } }
    } = context
    return `
        function ${state.funcMessageReceiver} ${Func([
            Var('m', 'Message'),
        ], 'void')} {
            ${messageSetSendReceive(context)}
            else {
                const ${Var('outMessage', 'Message')} = msg_bang()
                ${nodes[id].snds.$0}(outMessage)
                if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                    msgBusPublish(${state.sendBusName}, outMessage)
                }
                return
            }
        }

        ${declareControlSendReceive(context)}

        ${functional.renderIf(
            args.outputOnLoad, 
            `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`
        )}
    `
}

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = (context) => {
    const { state, globs } = context
    return ({
        '0': `
            ${state.funcMessageReceiver}(${globs.m})
            return
        `,
    })
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare,
    messages,
    stateVariables,
    globalCode: [
        bangUtils,
        messageBuses,
        coreCode.commonsWaitEngineConfigure,
        coreCode.commonsWaitFrame,
    ],
}

export { builder, nodeImplementation, NodeArguments }
