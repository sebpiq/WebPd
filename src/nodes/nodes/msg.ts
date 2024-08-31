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

import { Class, Message, MessageToken, Sequence, VariableNamesIndex } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { AnonFunc, ConstVar, Var, ast } from '@webpd/compiler'
import { AstElement } from '@webpd/compiler/src/ast/types'
import { msgBuses } from '../global-code/buses'

interface NodeArguments { msgSpecs: Array<MsgSpec> }

type _NodeImplementation = NodeImplementation<NodeArguments>

interface MsgSpec {
    tokens: Message,
    send: string | null,
}

// TODO : msg [ symbol $1 ( has the following behavior :
//      sends "" when receiving a number
//      sends <string> when receiving a string
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    skipDollarArgsResolution: true,
    translateArgs: ({ args }) => {
        const msgSpecs: Array<MsgSpec> = [{ tokens: [], send: null }]
        let index = 0
        let send: null | string = null

        while (index < args.length) {
            const arg = args[index++]
            if (arg === ',' || arg === ';') {
                // If this is the last token, we just ignore it
                // (no length - 1, because index was already incremented)
                if (index === args.length) {
                    continue
                }
                
                if (arg === ';') {
                    let send_ = args[index++]
                    if (typeof send_ !== 'string') {
                        throw new Error(`Expected a string after ";" from [msg( with args [${args.join(' ')}]`)
                    }
                    send = send_
                }
                msgSpecs.push({ tokens: [], send })
                
            } else {
                msgSpecs[msgSpecs.length - 1].tokens.push(arg)
            }
        }
        return {
            msgSpecs: msgSpecs
                .filter(msgSpec => msgSpec.tokens.length)
                .map(msgSpec => {
                    if (msgSpec.tokens[0] === 'symbol') {
                        msgSpec.tokens = [typeof msgSpec.tokens[1] === 'string' ? msgSpec.tokens[1]: '']
                    }
                    return msgSpec
                }),
        }
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

    state: ({ ns }) => 
        Class(ns.State, [
            Var(`Array<${ns.TokenSpec}>`, `msgSpecs`, `[]`),
        ]),

    initialization: (context, globals) => {
        const { node: { args }, state } = context
        const { msg } = globals
        const transferCode = args.msgSpecs.map(
            (msgSpec, i) => buildTransferCode(
                context,
                globals,
                msgSpec,
                i,
            )
        )
    
        return ast`
            ${state}.msgSpecs = [
                ${transferCode.map(({ isStaticMsg, code }, i) => ast`
                    {
                        transferFunction: ${AnonFunc([
                            Var(msg.Message, `inMessage`)
                        ], msg.Message)`
                            ${!isStaticMsg ? code: null}
                            return ${state}.msgSpecs[${i}].outMessage
                        `},
                        outTemplate: [],
                        outMessage: ${msg.EMPTY_MESSAGE},
                        send: ${args.msgSpecs[i].send ? `"${args.msgSpecs[i].send}"`: `""`},
                        hasSend: ${args.msgSpecs[i].send ? `true`: `false`},
                    },`
                )}
            ]

            ${transferCode
                .filter(({ isStaticMsg }) => isStaticMsg)
                .map(({ code }) => code)
            }
        `
    }, 

    messageReceivers: (
        {
            snds,
            state,
        }, 
        { 
            msg, msgBuses
        }
    ) => {
        return {
            '0': AnonFunc([Var(msg.Message, `m`)])`
                if (
                    ${msg.isStringToken}(m, 0) 
                    && ${msg.readStringToken}(m, 0) === 'set'
                ) {
                    ${ConstVar(msg.Template, `outTemplate`, `[]`)}
                    for (${Var(`Int`, `i`, `1`)}; i < ${msg.getLength}(m); i++) {
                        if (${msg.isFloatToken}(m, i)) {
                            outTemplate.push(${msg.FLOAT_TOKEN})
                        } else {
                            outTemplate.push(${msg.STRING_TOKEN})
                            outTemplate.push(${msg.readStringToken}(m, i).length)
                        }
                    }

                    ${ConstVar(msg.Message, `outMessage`, `${msg.create}(outTemplate)`)}
                    for (${Var(`Int`, `i`, `1`)}; i < ${msg.getLength}(m); i++) {
                        if (${msg.isFloatToken}(m, i)) {
                            ${msg.writeFloatToken}(
                                outMessage, i - 1, ${msg.readFloatToken}(m, i)
                            )
                        } else {
                            ${msg.writeStringToken}(
                                outMessage, i - 1, ${msg.readStringToken}(m, i)
                            )
                        }
                    }

                    ${state}.msgSpecs.splice(0, ${state}.msgSpecs.length - 1)
                    ${state}.msgSpecs[0] = {
                        transferFunction: ${AnonFunc([Var(msg.Message, `m`)], msg.Message)`
                            return ${state}.msgSpecs[0].outMessage
                        `},
                        outTemplate: outTemplate,
                        outMessage: outMessage,
                        send: "",
                        hasSend: false,
                    }
                    return
    
                } else {
                    for (${Var(`Int`, `i`, `0`)}; i < ${state}.msgSpecs.length; i++) {
                        if (${state}.msgSpecs[i].hasSend) {
                            ${msgBuses.publish}(${state}.msgSpecs[i].send, ${state}.msgSpecs[i].transferFunction(m))
                        } else {
                            ${snds.$0}(${state}.msgSpecs[i].transferFunction(m))
                        }
                    }
                    return
                }
            `,
        }
    },

    core: ({ ns }, { msg }) => Sequence([
        Class(ns.TokenSpec, [
            Var(`(m: ${msg.Message}) => ${msg.Message}`, `transferFunction`),
            Var(msg.Template, `outTemplate`),
            Var(msg.Message, `outMessage`),
            Var(`string`, `send`),
            Var(`boolean`, `hasSend`),
        ])
    ]),

    dependencies: [ msgBuses ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}

// ---------------------------------------------------------------------------- //

const buildTransferCode = (
    { state }: Parameters<_NodeImplementation['initialization']>[0],
    { msg }: VariableNamesIndex['globals'],
    msgSpec: MsgSpec, 
    index: number,
) => {
    const outTemplate = `${state}.msgSpecs[${index}].outTemplate`
    const outMessage = `${state}.msgSpecs[${index}].outMessage`
    let outTemplateCode: Array<AstElement> = []
    let outMessageCode: Array<AstElement> = []
    let stringMemCount = 0
    let hasStringTemplate = false
    let isStaticMsg = true

    msgSpec.tokens.forEach((token, outIndex) => {
        const operation = guessTokenOperation(token)
        if (operation.type === 'noop') {
            isStaticMsg = false
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
            isStaticMsg = false
            hasStringTemplate = true
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

    const initCode = ast`
        ${hasStringTemplate ? Var(`string`, `stringToken`): null}
        ${hasStringTemplate ? Var(`string`, `otherStringToken`): null}
        ${!isStaticMsg ? Var(`Array<string>`, `stringMem`, `[]`): null}
    `
    outTemplateCode.unshift(ast`${outTemplate} = []`)
    outMessageCode.unshift(ast`${outMessage} = ${msg.create}(${outTemplate})`)

    return {
        isStaticMsg,
        code: Sequence([
            initCode,
            ...outTemplateCode,
            ...outMessageCode,
        ])
    }
}

const guessTokenOperation = (
    token: MessageToken
): MessageTokenOperation => {
    if (typeof token === 'string') {
        const matchDollar = DOLLAR_VAR_RE.exec(token)

        // If the transfer is a dollar var :
        //      ['bla', 789] - ['$1'] -> ['bla']
        //      ['bla', 789] - ['$2'] -> [789]
        if (matchDollar && matchDollar[0] === token) {
            // -1, because $1 corresponds to value 0.
            const inIndex = parseInt(matchDollar[1], 10) - 1
            return { type: 'noop', inIndex }
        } else if (matchDollar) {
            const variables: MessageTokenOperationStringTemplate['variables'] =
                []
            let matched: RegExpMatchArray | null
            while ((matched = DOLLAR_VAR_RE_GLOB.exec(token))) {
                // position -1, because $1 corresponds to value 0.
                variables.push({
                    placeholder: matched[0],
                    inIndex: parseInt(matched[1]!, 10) - 1,
                })
            }
            return {
                type: 'string-template',
                template: token,
                variables,
            }

            // Else the input doesn't matter
        } else {
            return { type: 'string-constant', value: token }
        }
    } else {
        return { type: 'float-constant', value: token }
    }
}

const DOLLAR_VAR_RE = /\$(\d+)/
const DOLLAR_VAR_RE_GLOB = /\$(\d+)/g

interface MessageTokenOperationNoop {
    type: 'noop'
    inIndex: number
}

interface MessageTokenOperationFloatConstant {
    type: 'float-constant'
    value: number
}

interface MessageTokenOperationStringConstant {
    type: 'string-constant'
    value: string
}

interface MessageTokenOperationStringTemplate {
    type: 'string-template'
    template: string
    variables: Array<{ placeholder: string; inIndex: number }>
}

type MessageTokenOperation =
    | MessageTokenOperationNoop
    | MessageTokenOperationFloatConstant
    | MessageTokenOperationStringConstant
    | MessageTokenOperationStringTemplate
