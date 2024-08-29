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

import { Class, DspGraph, VariableNamesIndex } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { AstElement } from '@webpd/compiler/src/ast/types'

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

// ------------------------------ node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {

    state: ({ ns }, { msg }) => 
        Class(ns.State, [
            Var(`Array<${msg.Template}>`, `outTemplates`, `[]`),
            Var(`Array<${msg.Message}>`, `outMessages`, `[]`),
            Var(`Array<(m: ${msg.Message}) => ${msg.Message}>`, `messageTransferFunctions`, `[]`),
        ]),

    initialization: (context, globals) => {
        const { node: { args }, state } = context
        const { msg } = globals
        const transferCodes = args.templates.map(
            (template, i) => buildMsgTransferCode(
                context,
                globals,
                template,
                i,
            )
        )
    
        return ast`
            ${transferCodes
                .filter(({ inMessageUsed }) => !inMessageUsed)
                .map(({ outMessageCode }) => outMessageCode)
            }
            
            ${state}.messageTransferFunctions = [
                ${transferCodes.flatMap(({ inMessageUsed, outMessageCode }, i) => [
                    AnonFunc([
                        Var(msg.Message, `inMessage`)
                    ], msg.Message)`
                        ${inMessageUsed ? outMessageCode: null}
                        return ${state}.outMessages[${i}]
                    `, ','
                ])}
            ]
        `
    }, 

    messageReceivers: (
        {
            snds,
            state,
        }, 
        { msg }
    ) => {
        return {
            '0': AnonFunc([Var(msg.Message, `m`)])`
                if (
                    ${msg.isStringToken}(m, 0) 
                    && ${msg.readStringToken}(m, 0) === 'set'
                ) {
                    ${state}.outTemplates = [[]]
                    for (${Var(`Int`, `i`, `1`)}; i < ${msg.getLength}(m); i++) {
                        if (${msg.isFloatToken}(m, i)) {
                            ${state}.outTemplates[0].push(${msg.FLOAT_TOKEN})
                        } else {
                            ${state}.outTemplates[0].push(${msg.STRING_TOKEN})
                            ${state}.outTemplates[0].push(${msg.readStringToken}(m, i).length)
                        }
                    }
    
                    ${ConstVar(msg.Message, `message`, `${msg.create}(${state}.outTemplates[0])`)}
                    for (${Var(`Int`, `i`, `1`)}; i < ${msg.getLength}(m); i++) {
                        if (${msg.isFloatToken}(m, i)) {
                            ${msg.writeFloatToken}(
                                message, i - 1, ${msg.readFloatToken}(m, i)
                            )
                        } else {
                            ${msg.writeStringToken}(
                                message, i - 1, ${msg.readStringToken}(m, i)
                            )
                        }
                    }
                    ${state}.outMessages[0] = message
                    ${state}.messageTransferFunctions.splice(0, ${state}.messageTransferFunctions.length - 1)
                    ${state}.messageTransferFunctions[0] = ${AnonFunc([Var(msg.Message, `m`)], msg.Message)`
                        return ${state}.outMessages[0]
                    `}
                    return
    
                } else {
                    for (${Var(`Int`, `i`, `0`)}; i < ${state}.messageTransferFunctions.length; i++) {
                        ${snds.$0}(${state}.messageTransferFunctions[i](m))
                    }
                    return
                }
            `,
        }
    },
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}

// ---------------------------------------------------------------------------- //

const buildMsgTransferCode = (
    { state }: Parameters<_NodeImplementation['initialization']>[0],
    { msg }: VariableNamesIndex['globals'],
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
                ${outTemplate}.push(${msg.getTokenType}(inMessage, ${inIndex}))
                if (${msg.isStringToken}(inMessage, ${inIndex})) {
                    stringMem[${stringMemCount}] = ${msg.readStringToken}(inMessage, ${inIndex})
                    ${outTemplate}.push(stringMem[${stringMemCount}].length)
                }
            `)
            outMessageCode.push(ast`
                if (${msg.isFloatToken}(inMessage, ${inIndex})) {
                    ${msg.writeFloatToken}(${outMessage}, ${outIndex}, ${msg.readFloatToken}(inMessage, ${inIndex}))
                } else if (${msg.isStringToken}(inMessage, ${inIndex})) {
                    ${msg.writeStringToken}(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
                }
            `)
            stringMemCount++
        } else if (operation.type === 'string-template') {
            outTemplateCode.push(ast`
                stringToken = "${operation.template}"
                ${operation.variables.map(({placeholder, inIndex}) => `
                    if (${msg.isFloatToken}(inMessage, ${inIndex})) {
                        otherStringToken = ${msg.readFloatToken}(inMessage, ${inIndex}).toString()
                        if (otherStringToken.endsWith('.0')) {
                            otherStringToken = otherStringToken.slice(0, -2)
                        }
                        stringToken = stringToken.replace("${placeholder}", otherStringToken)
                    } else if (${msg.isStringToken}(inMessage, ${inIndex})) {
                        stringToken = stringToken.replace("${placeholder}", ${msg.readStringToken}(inMessage, ${inIndex}))
                    }`
                ).join('\n')}
                stringMem[${stringMemCount}] = stringToken
                ${outTemplate}.push(${msg.STRING_TOKEN})
                ${outTemplate}.push(stringMem[${stringMemCount}].length)
            `)
            outMessageCode.push(ast`
                ${msg.writeStringToken}(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
            `)
            stringMemCount++
        } else if (operation.type === 'string-constant') {
            outTemplateCode.push(ast`
                ${outTemplate}.push(${msg.STRING_TOKEN})
                ${outTemplate}.push(${operation.value.length})
            `)
            outMessageCode.push(ast`
                ${msg.writeStringToken}(${outMessage}, ${outIndex}, "${operation.value}")
            `)
        } else if (operation.type === 'float-constant') {
            outTemplateCode.push(ast`
                ${outTemplate}.push(${msg.FLOAT_TOKEN})
            `)
            outMessageCode.push(ast`
                ${msg.writeFloatToken}(${outMessage}, ${outIndex}, ${operation.value})
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
            ${hasStringTemplate ? Var(`string`, `stringToken`): null}
            ${hasStringTemplate ? Var(`string`, `otherStringToken`): null}
            ${inMessageUsed ? Var(`Array<string>`, `stringMem`, `[]`): null}
            ${outTemplate} = []
            ${outTemplateCode}
            ${outMessage} = ${msg.create}(${outTemplate})
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
