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

import { DspGraph, functional } from '@webpd/compiler-js'
import { Code, NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'

interface NodeArguments { templates: Array<Array<DspGraph.NodeArgument>> }
const stateVariables = {
    outTemplates: 1,
    outMessages: 1,
    messageTransferFunctions: 1
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : msg [ symbol $1 ( has the fllowing behavior :
//      sends "" when receiving a number
//      sends <string> when receiving a string
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    skipDollarArgsResolution: true,
    translateArgs: ({ args }) => {
        const templates: Array<Array<DspGraph.NodeArgument>> = [[]]
        args.forEach(arg => {
            if (arg === ',') {
                templates.push([])
            } else {
                templates[templates.length - 1].push(arg)
            }
        })
        return ({
            templates: templates
                .filter(template => template.length)
                .map(template => {
                    if (template[0] === 'symbol') {
                        return [typeof template[1] === 'string' ? template[1]: '' || '']
                    }
                    return template
                }),
        })
    },
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = (context) => {
    const {
        state,
        node,
        macros: { Var, Func },
    } = context
    const transferCodes = node.args.templates.map((template, i) => buildMsgTransferCode(
        context,
        template,
        i
    ))

    return functional.renderCode`
        let ${Var(state.outTemplates, 'Array<MessageTemplate>')} = []
        let ${Var(state.outMessages, 'Array<Message>')} = []
        ${transferCodes.map(({ inMessageUsed, outMessageCode }) => 
            functional.renderIf(!inMessageUsed, outMessageCode))}
        
        const ${Var(state.messageTransferFunctions, 'Array<(m: Message) => Message>')} = [
            ${transferCodes.map(({ inMessageUsed, outMessageCode }, i) => `
                ${Func([
                    Var('inMessage', 'Message')
                ], 'Message')} => {
                    ${functional.renderIf(inMessageUsed, outMessageCode)}
                    return ${state.outMessages}[${i}]
                }`
            ).join(',')}
        ]
    `
}

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    snds,
    state,
    globs,
    macros: { Var, Func },
}) => {
    return {
        '0': `
        if (
            msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'set'
        ) {
            ${state.outTemplates} = [[]]
            for (let ${Var('i', 'Int')} = 1; i < msg_getLength(${globs.m}); i++) {
                if (msg_isFloatToken(${globs.m}, i)) {
                    ${state.outTemplates}[0].push(MSG_FLOAT_TOKEN)
                } else {
                    ${state.outTemplates}[0].push(MSG_STRING_TOKEN)
                    ${state.outTemplates}[0].push(msg_readStringToken(${globs.m}, i).length)
                }
            }

            const ${Var('message', 'Message')} = msg_create(${state.outTemplates}[0])
            for (let ${Var('i', 'Int')} = 1; i < msg_getLength(${globs.m}); i++) {
                if (msg_isFloatToken(${globs.m}, i)) {
                    msg_writeFloatToken(
                        message, i - 1, msg_readFloatToken(${globs.m}, i)
                    )
                } else {
                    msg_writeStringToken(
                        message, i - 1, msg_readStringToken(${globs.m}, i)
                    )
                }
            }
            ${state.outMessages}[0] = message
            ${state.messageTransferFunctions}.splice(0, ${state.messageTransferFunctions}.length - 1)
            ${state.messageTransferFunctions}[0] = ${Func([
                Var('m', 'Message')
            ], 'Message')} => { return ${state.outMessages}[0] }
            return

        } else {
            for (let ${Var('i', 'Int')} = 0; i < ${state.messageTransferFunctions}.length; i++) {
                ${snds.$0}(${state.messageTransferFunctions}[i](${globs.m}))
            }
            return    
        }
    `,
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {declare, messages, stateVariables}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}

const buildMsgTransferCode = (
    { state, macros: { Var } }: Parameters<_NodeImplementation['declare']>[0],
    template: Array<DspGraph.NodeArgument>, 
    index: number,
) => {
    const outTemplate = `${state.outTemplates}[${index}]`
    const outMessage = `${state.outMessages}[${index}]`
    const operations = buildMessageTransferOperations(template)
    let outTemplateCode: Code = ''
    let outMessageCode: Code = ''
    let stringMemCount = 0

    operations.forEach((operation, outIndex) => {
        if (operation.type === 'noop') {
            const { inIndex } = operation
            outTemplateCode += `
                ${outTemplate}.push(msg_getTokenType(inMessage, ${inIndex}))
                if (msg_isStringToken(inMessage, ${inIndex})) {
                    stringMem[${stringMemCount}] = msg_readStringToken(inMessage, ${inIndex})
                    ${outTemplate}.push(stringMem[${stringMemCount}].length)
                }
            `
            outMessageCode += `
                if (msg_isFloatToken(inMessage, ${inIndex})) {
                    msg_writeFloatToken(${outMessage}, ${outIndex}, msg_readFloatToken(inMessage, ${inIndex}))
                } else if (msg_isStringToken(inMessage, ${inIndex})) {
                    msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
                }
            `
            stringMemCount++
        } else if (operation.type === 'string-template') {
            outTemplateCode += functional.renderCode`
                stringToken = "${operation.template}"
                ${operation.variables.map(({placeholder, inIndex}) => `
                    if (msg_isFloatToken(inMessage, ${inIndex})) {
                        otherStringToken = msg_readFloatToken(inMessage, ${inIndex}).toString()
                        if (otherStringToken.endsWith('.0')) {
                            otherStringToken = otherStringToken.slice(0, -2)
                        }
                        stringToken = stringToken.replace("${placeholder}", otherStringToken)
                    } else if (msg_isStringToken(inMessage, ${inIndex})) {
                        stringToken = stringToken.replace("${placeholder}", msg_readStringToken(inMessage, ${inIndex}))
                    }`
                )}
                stringMem[${stringMemCount}] = stringToken
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(stringMem[${stringMemCount}].length)
            `
            outMessageCode += `
                msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
            `
            stringMemCount++
        } else if (operation.type === 'string-constant') {
            outTemplateCode += `
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(${operation.value.length})
            `
            outMessageCode += `
                msg_writeStringToken(${outMessage}, ${outIndex}, "${operation.value}")
            `
        } else if (operation.type === 'float-constant') {
            outTemplateCode += `
                ${outTemplate}.push(MSG_FLOAT_TOKEN)
            `
            outMessageCode += `
                msg_writeFloatToken(${outMessage}, ${outIndex}, ${operation.value})
            `
        }
    })

    const hasStringTemplate = operations.some((op) => op.type === 'string-template')
    const inMessageUsed = operations.some(
        (op) => op.type === 'noop' || op.type === 'string-template'
    )

    return {
        inMessageUsed,
        outMessageCode: `
            ${functional.renderIf(
                hasStringTemplate,
                `let ${Var('stringToken', 'string')}`
            )}
            ${functional.renderIf(
                hasStringTemplate,
                `let ${Var('otherStringToken', 'string')}`
            )}
            ${functional.renderIf(
                inMessageUsed,
                `let ${Var('stringMem', 'Array<string>')} = []`
            )}
            ${outTemplate} = []
            ${outTemplateCode}           
            ${outMessage} = msg_create(${outTemplate})
            ${outMessageCode}
        `,
    }
}

const buildMessageTransferOperations = (
    template: Array<DspGraph.NodeArgument>
): Array<MessageTransferOperation> => {
    // Creates an array of transfer functions `inVal -> outVal`.
    return template.map((templateElem) => {
        if (typeof templateElem === 'string') {
            const matchDollar = DOLLAR_VAR_RE.exec(templateElem)

            // If the transfer is a dollar var :
            //      ['bla', 789] - ['$1'] -> ['bla']
            //      ['bla', 789] - ['$2'] -> [789]
            if (matchDollar && matchDollar[0] === templateElem) {
                // -1, because $1 corresponds to value 0.
                const inIndex = parseInt(matchDollar[1], 10) - 1
                return { type: 'noop', inIndex }
            } else if (matchDollar) {
                const variables: MessageTransferOperationStringTemplate['variables'] =
                    []
                let matched: RegExpMatchArray | null
                while ((matched = DOLLAR_VAR_RE_GLOB.exec(templateElem))) {
                    // position -1, because $1 corresponds to value 0.
                    variables.push({
                        placeholder: matched[0],
                        inIndex: parseInt(matched[1]!, 10) - 1,
                    })
                }
                return {
                    type: 'string-template',
                    template: templateElem,
                    variables,
                }

                // Else the input doesn't matter
            } else {
                return { type: 'string-constant', value: templateElem }
            }
        } else {
            return { type: 'float-constant', value: templateElem }
        }
    })
}

const DOLLAR_VAR_RE = /\$(\d+)/
const DOLLAR_VAR_RE_GLOB = /\$(\d+)/g

interface MessageTransferOperationNoop {
    type: 'noop'
    inIndex: number
}

interface MessageTransferOperationFloatConstant {
    type: 'float-constant'
    value: number
}

interface MessageTransferOperationStringConstant {
    type: 'string-constant'
    value: string
}

interface MessageTransferOperationStringTemplate {
    type: 'string-template'
    template: string
    variables: Array<{ placeholder: string; inIndex: number }>
}

type MessageTransferOperation =
    | MessageTransferOperationNoop
    | MessageTransferOperationFloatConstant
    | MessageTransferOperationStringConstant
    | MessageTransferOperationStringTemplate
