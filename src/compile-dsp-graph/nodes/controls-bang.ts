/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */
import { functional } from '@webpd/compiler-js'
import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../types'
import { assertOptionalString } from '../nodes-shared-code/validation'
import { build, declareControlSendReceive, EMPTY_BUS_NAME, messageSetSendReceive, ControlsBaseNodeArguments, stateVariables } from './controls-base'
import { messageBuses } from '../nodes-shared-code/buses'
import { bangUtils } from '../nodes-shared-code/core'

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
    sharedCode: [ bangUtils, messageBuses ],
}

export { builder, nodeImplementation, NodeArguments }
