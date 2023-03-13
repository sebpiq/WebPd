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
import { Code, functional } from '@webpd/compiler'
import { CodeVariableName, NodeImplementation } from '@webpd/compiler/src/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { build, declareControlSendReceive, EMPTY_BUS_NAME, messageSetSendReceive, ControlsBaseNodeArguments, stateVariables } from './controls-base'
import { messageBuses } from '../nodes-shared-code/buses'
import { bangUtils, msgUtils } from '../nodes-shared-code/core'

export type _NodeImplementation = NodeImplementation<
    ControlsBaseNodeArguments,
    typeof stateVariables
>

// TODO : use standard "unsupported message" from compile-declare
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<ControlsBaseNodeArguments> = {
    translateArgs: ({ args: [_, __, receive, send] }: PdJson.AtomNode) => ({
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
}

const makeNodeImplementation = ({
    initValue,
    messageMatch,
}: {
    initValue: Code,
    messageMatch?: (messageName: CodeVariableName) => Code
}): _NodeImplementation => {

    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = (context) => {
        const { 
            state,
            globs,
            macros: { Var, Func },
            node: { id },
            compilation: { codeVariableNames: { nodes } }
        } = context
        return `
            let ${Var(state.value, 'Message')} = ${initValue}
            
            function ${state.funcMessageReceiver} ${Func([
                Var('m', 'Message'),
            ], 'void')} {
                ${messageSetSendReceive(context)}
                else if (msg_isBang(m)) {
                    ${nodes[id].snds.$0}(${state.value})
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, ${state.value})
                    }
                    return
                
                } else if (
                    msg_getTokenType(${globs.m}, 0) === MSG_STRING_TOKEN
                    && msg_readStringToken(${globs.m}, 0) === 'set'
                ) {
                    const ${Var('setMessage','Message')} = msg_slice(${globs.m}, 1, msg_getLength(${globs.m}))
                    ${functional.renderIf(messageMatch, 
                        () => `if (${messageMatch('setMessage')}) {`)} 
                            ${state.value} = setMessage    
                            return
                    ${functional.renderIf(messageMatch, 
                        () => '}')}

                } ${messageMatch ? 
                    `else if (${messageMatch('m')}) {`: 
                    `else {`}
                
                    ${state.value} = m
                    ${nodes[id].snds.$0}(${state.value})
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, ${state.value})
                    }
                    return

                }
                throw new Error('unsupported message ' + msg_display(m))
            }

            ${declareControlSendReceive(context)}
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
    return {
        declare,
        messages,
        stateVariables,
        sharedCode: [ bangUtils, messageBuses, msgUtils ],
    }
}

const builders = {
    'floatatom': builder,
    'symbolatom': builder,
    'listbox': builder,
}

const nodeImplementations = {
    'floatatom': makeNodeImplementation({
        initValue: `msg_floats([0])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_FLOAT_TOKEN])`
    }),
    'symbolatom': makeNodeImplementation({
        initValue: `msg_strings([''])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_STRING_TOKEN])`
    }),
    'listbox': makeNodeImplementation({
        initValue: `msg_bang()`,
    })
}

export { builders, nodeImplementations, ControlsBaseNodeArguments as NodeArguments }
