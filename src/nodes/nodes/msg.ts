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

import { Class, DspGraph, Sequence, functional } from '@webpd/compiler'
import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { AstElement } from '@webpd/compiler/src/ast/types'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments { templates: Array<Array<DspGraph.NodeArgument>> }

type _NodeImplementation = NodeImplementation<NodeArguments>

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

// ------------------------------ generateDeclarations ------------------------------ //
const variableNames = generateVariableNamesNodeType('msg')

const nodeCore: GlobalCodeGenerator = () => Sequence([
    Class(variableNames.stateClass, [
        Var('Array<MessageTemplate>', 'outTemplates'),
        Var('Array<Message>', 'outMessages'),
        Var('Array<(m: Message) => Message>', 'messageTransferFunctions'),
    ]),
])

const generateInitialization: _NodeImplementation['generateInitialization'] = (context) => {
    const { node: { args }, state } = context
    const transferCodes = args.templates.map(
        (template, i) => buildMsgTransferCode(
            context,
            template,
            i
        )
    )

    return ast`
        ${ConstVar(variableNames.stateClass, state, `{
            outTemplates: [],
            outMessages: [],
            messageTransferFunctions: [],
        }`)}

        ${transferCodes
            .filter(({ inMessageUsed }) => !inMessageUsed)
            .map(({ outMessageCode }) => outMessageCode)
        }
        
        ${state}.messageTransferFunctions = [
            ${transferCodes.flatMap(({ inMessageUsed, outMessageCode }, i) => [
                AnonFunc([
                    Var('Message', 'inMessage')
                ], 'Message')`
                    ${inMessageUsed ? outMessageCode: null}
                    return ${state}.outMessages[${i}]
                `, ','
            ])}
        ]
    `
}

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({
    snds,
    state,
}) => {
    return {
        '0': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isStringToken(m, 0) 
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${state}.outTemplates = [[]]
                for (${Var('Int', 'i', '1')}; i < msg_getLength(m); i++) {
                    if (msg_isFloatToken(m, i)) {
                        ${state}.outTemplates[0].push(MSG_FLOAT_TOKEN)
                    } else {
                        ${state}.outTemplates[0].push(MSG_STRING_TOKEN)
                        ${state}.outTemplates[0].push(msg_readStringToken(m, i).length)
                    }
                }

                ${ConstVar('Message', 'message', `msg_create(${state}.outTemplates[0])`)}
                for (${Var('Int', 'i', '1')}; i < msg_getLength(m); i++) {
                    if (msg_isFloatToken(m, i)) {
                        msg_writeFloatToken(
                            message, i - 1, msg_readFloatToken(m, i)
                        )
                    } else {
                        msg_writeStringToken(
                            message, i - 1, msg_readStringToken(m, i)
                        )
                    }
                }
                ${state}.outMessages[0] = message
                ${state}.messageTransferFunctions.splice(0, ${state}.messageTransferFunctions.length - 1)
                ${state}.messageTransferFunctions[0] = ${AnonFunc([Var('Message', 'm')], 'Message')`
                    return ${state}.outMessages[0]
                `}
                return

            } else {
                for (${Var('Int', 'i', '0')}; i < ${state}.messageTransferFunctions.length; i++) {
                    ${snds.$0}(${state}.messageTransferFunctions[i](m))
                }
                return
            }
        `,
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateInitialization, 
    generateMessageReceivers,
    dependencies: [nodeCore],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}

const buildMsgTransferCode = (
    { state }: Parameters<_NodeImplementation['generateInitialization']>[0],
    template: Array<DspGraph.NodeArgument>, 
    index: number,
) => {
    const outTemplate = `${state}.outTemplates[${index}]`
    const outMessage = `${state}.outMessages[${index}]`
    const operations = buildMessageTransferOperations(template)
    let outTemplateCode: Array<AstElement> = []
    let outMessageCode: Array<AstElement> = []
    let stringMemCount = 0

    operations.forEach((operation, outIndex) => {
        if (operation.type === 'noop') {
            const { inIndex } = operation
            outTemplateCode.push(ast`
                ${outTemplate}.push(msg_getTokenType(inMessage, ${inIndex}))
                if (msg_isStringToken(inMessage, ${inIndex})) {
                    stringMem[${stringMemCount}] = msg_readStringToken(inMessage, ${inIndex})
                    ${outTemplate}.push(stringMem[${stringMemCount}].length)
                }
            `)
            outMessageCode.push(ast`
                if (msg_isFloatToken(inMessage, ${inIndex})) {
                    msg_writeFloatToken(${outMessage}, ${outIndex}, msg_readFloatToken(inMessage, ${inIndex}))
                } else if (msg_isStringToken(inMessage, ${inIndex})) {
                    msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
                }
            `)
            stringMemCount++
        } else if (operation.type === 'string-template') {
            outTemplateCode.push(ast`
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
                ).join('\n')}
                stringMem[${stringMemCount}] = stringToken
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(stringMem[${stringMemCount}].length)
            `)
            outMessageCode.push(ast`
                msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
            `)
            stringMemCount++
        } else if (operation.type === 'string-constant') {
            outTemplateCode.push(ast`
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(${operation.value.length})
            `)
            outMessageCode.push(ast`
                msg_writeStringToken(${outMessage}, ${outIndex}, "${operation.value}")
            `)
        } else if (operation.type === 'float-constant') {
            outTemplateCode.push(ast`
                ${outTemplate}.push(MSG_FLOAT_TOKEN)
            `)
            outMessageCode.push(ast`
                msg_writeFloatToken(${outMessage}, ${outIndex}, ${operation.value})
            `)
        }
    })

    const hasStringTemplate = operations.some((op) => op.type === 'string-template')
    const inMessageUsed = operations.some(
        (op) => op.type === 'noop' || op.type === 'string-template'
    )

    return {
        inMessageUsed,
        outMessageCode: ast`
            ${hasStringTemplate ? Var('string', 'stringToken'): null}
            ${hasStringTemplate ? Var('string', 'otherStringToken'): null}
            ${inMessageUsed ? Var('Array<string>', 'stringMem', '[]'): null}
            ${outTemplate} = []
            ${outTemplateCode}
            ${outMessage} = msg_create(${outTemplate})
            ${outMessageCode}
        `
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
