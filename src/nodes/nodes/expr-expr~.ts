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

import { Code, stdlib, functional } from '@webpd/compiler'
import {
    NodeImplementation,
    NodeImplementations,
    PrecompiledNodeCode,
} from '@webpd/compiler/src/compile/types'
import { PdJson } from '@webpd/pd-parser'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { bangUtils } from '../global-code/core'
import { roundFloatAsPdInt } from '../global-code/numbers'
import {
    messageTokenToFloat,
    messageTokenToString,
} from '../type-arguments'
import { AnonFunc, ast, ConstVar, Sequence, Var } from '@webpd/compiler/src/ast/declare'

interface NodeArguments {
    tokenizedExpressions: Array<Array<ExpressionToken>>
}
const stateVariables = {
    floatInputs: 1,
    stringInputs: 1,
    outputs: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : Implement if (`if(<test>, <then>, <else>)`)
// TODO : [expr random(0, 10000)] fails (no inlet), and random function doesn't exist
// ------------------------------- node builder ------------------------------ //
const builderExpr: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        tokenizedExpressions:
            preprocessExpression(args).map(tokenizeExpression),
    }),
    build: (args) => ({
        inlets: functional.mapArray(
            validateAndListInputsExpr(args.tokenizedExpressions),
            ({ id }) => [`${id}`, { type: 'message', id: `${id}` }]
        ),

        outlets: functional.mapArray(args.tokenizedExpressions, (_, i) => [
            `${i}`,
            { type: 'message', id: `${i}` },
        ]),
    }),
}

const builderExprTilde: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        tokenizedExpressions:
            preprocessExpression(args).map(tokenizeExpression),
    }),
    build: (args) => ({
        inlets: functional.mapArray(
            validateAndListInputsExprTilde(args.tokenizedExpressions),
            ({ id, type }) => [
                `${id}`,
                { type: type === 'signal' ? 'signal' : 'message', id: `${id}` },
            ]
        ),

        outlets: functional.mapArray(args.tokenizedExpressions, (_, i) => [
            `${i}`,
            { type: 'signal', id: `${i}` },
        ]),
    }),
}

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    node: { args, type },
    state,
}) => {
    const inputs = type === 'expr' ? 
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal')

    return ast`
        ${ConstVar('Map<Int, Float>', state.floatInputs, 'new Map()')}
        ${ConstVar('Map<Int, string>', state.stringInputs, 'new Map()')}
        ${ConstVar('Array<Float>', state.outputs, `new Array(${args.tokenizedExpressions.length})`)}
        ${inputs.filter(input => input.type === 'float' || input.type === 'int')
            .map(input => `${state.floatInputs}.set(${input.id}, 0)`)}
        ${inputs.filter(input => input.type === 'string')
            .map(input => `${state.stringInputs}.set(${input.id}, '')`)}
    `
}

// ------------------------------- generateLoop ------------------------------ //
const loopExprTilde: _NodeImplementation['generateLoop'] = ({
    node: { args },
    state,
    outs, 
    ins,
}) => Sequence(
    args.tokenizedExpressions.map((tokens, i) => 
        `${outs[i]} = ${renderTokenizedExpression(state, ins, tokens)}`)
) 

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ 
    snds, 
    state, 
    node: { args, type },
}) => {
    const inputs = type === 'expr' ? 
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal')
    
    const hasInput0 = inputs.length && inputs[0].id === 0

    return {
        '0': AnonFunc([Var('Message', 'm')], 'void')`
            if (!msg_isBang(m)) {
                for (${Var('Int', 'i', '0')}; i < msg_getLength(m); i++) {
                    ${state.stringInputs}.set(i, messageTokenToString(m, i))
                    ${state.floatInputs}.set(i, messageTokenToFloat(m, i))
                }
            }

            ${functional.renderIf(
                type === 'expr', 
                () => `
                    ${args.tokenizedExpressions.map((tokens, i) => 
                        `${state.outputs}[${i}] = ${renderTokenizedExpression(state, null, tokens)}`)}
            
                    ${args.tokenizedExpressions.map((_, i) => 
                        `${snds[`${i}`]}(msg_floats([${state.outputs}[${i}]]))`)}
                `
            )}
            
            return
        `,

        ...functional.mapArray(
            inputs.slice(hasInput0 ? 1 : 0), 
            ({ id, type }) => {
                if (type === 'float' || type === 'int') {
                    return [
                        `${id}`, 
                        AnonFunc([Var('Message', 'm')], 'void')`
                            ${state.floatInputs}.set(${id}, messageTokenToFloat(m, 0));return
                        `
                    ]
                } else if (type === 'string') {
                    return [
                        `${id}`, 
                        AnonFunc([Var('Message', 'm')], 'void')`
                            ${state.stringInputs}.set(${id}, messageTokenToString(m, 0));return
                        `
                    ]
                } else {
                    throw new Error(`invalid input type ${type}`)
                }
            }
        )
    }
}

// ------------------------------------------------------------------- //
// NOTE: Normally we'd use named regexp capturing groups, but that causes problems with 
// create-react-app which uses a babel plugin to remove them.
export const TOKENIZE_REGEXP = /(?<f>\$f(?<id_f>[0-9]+))|(?<v>\$v(?<id_v>[0-9]+))|(?<i>\$i(?<id_i>[0-9]+))|(?<s>\$s(?<id_s>[0-9]+)\s*\[(?<sIndex>[^\[\]]*)\])/

interface ExpressionTokenFloat {
    type: 'float'
    id: number
}

interface ExpressionTokenSignal {
    type: 'signal'
    id: number
}

interface ExpressionTokenInt {
    type: 'int'
    id: number
}

interface ExpressionTokenString {
    type: 'string'
    id: number
}

interface ExpressionTokenIndexingStart {
    type: 'indexing-start'
}

interface ExpressionTokenIndexingEnd {
    type: 'indexing-end'
}

interface ExpressionTokenRaw {
    type: 'raw'
    content: string
}

type InputToken = ExpressionTokenString
    | ExpressionTokenFloat
    | ExpressionTokenInt
    | ExpressionTokenSignal

export type ExpressionToken = ExpressionTokenRaw
    | ExpressionTokenIndexingStart
    | ExpressionTokenIndexingEnd
    | InputToken

export const tokenizeExpression = (expression: string) => {
    let match: RegExpMatchArray
    let tokens: Array<ExpressionToken> = []
    while (match = TOKENIZE_REGEXP.exec(expression)) {
        if (match.index) {
            tokens.push({
                type: 'raw',
                content: expression.slice(0, match.index)
            })
        }

        if (match[1]) {
            tokens.push({
                type: 'float',
                id: parseInt(match[2]) - 1,
            })

        } else if (match[3]) {
            tokens.push({
                type: 'signal',
                id: parseInt(match[4]) - 1,
            })

        } else if (match[5]) {
            tokens.push({
                type: 'int',
                id: parseInt(match[6]) - 1,
            })
        
        // Symbols in an expr are used normally only to index an array.
        // Since we need to cast to an int to index an array, we need 
        // to wrap the indexing expression with a cast to int :
        // $s1[$i1 + 2] -> $s1[toInt($i1 + 2)]
        } else if (match[7]) {
            tokens = [
                ...tokens, 
                {
                    type: 'string',
                    id: parseInt(match[8]) - 1,
                },
                {
                    type: 'indexing-start'
                },
                ...tokenizeExpression(match[9]),
                {
                    type: 'indexing-end'
                },
            ]
        }
        expression = expression.slice(match.index + match[0].length)
    }
    if (expression.length) {
        tokens.push({
            type: 'raw',
            content: expression
        })
    }
    return tokens
}

export const renderTokenizedExpression = (
    state: { [Parameter in keyof typeof stateVariables]: string },
    ins: PrecompiledNodeCode['ins'] | null,
    tokens: Array<ExpressionToken>, 
): Code =>
    // Add '+(' to convert for example boolean output to float
    '+(' + tokens.map(token => {
        switch(token.type) {
            case 'float':
                return `${state.floatInputs}.get(${token.id})`
            case 'signal':
                if (ins === null) {
                    throw new Error(`invalid token signal received`)
                }
                return ins[token.id]
            case 'int':
                return `roundFloatAsPdInt(${state.floatInputs}.get(${token.id}))`
            case 'string':
                return `commons_getArray(${state.stringInputs}.get(${token.id}))`
            case 'indexing-start':
                return '[toInt('
            case 'indexing-end':
                return ')]'
            case 'raw':
                return token.content
        }
    }).join('') + ')'

export const listInputs = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    const inputs: Array<InputToken> = []
    tokenizedExpressions.forEach(tokenizedExpression => {
        tokenizedExpression.forEach(token => {
            if (
                token.type === 'float' 
                || token.type === 'signal'
                || token.type === 'int'
                || token.type === 'string'
            ) {
                inputs.push(token)
            }
        })
    })

    // Sort so that input 0 appears first if it exists
    inputs.sort(({id: i1}, {id: i2}) => i1 - i2)
    const inputsMap = new Map<number, InputToken>()
    return inputs.filter(token => {
        if (inputsMap.has(token.id)) {
            if (inputsMap.get(token.id).type !== token.type) {
                throw new Error(`contradictory definitions for input ${token.id}`)
            }
            return false
        } else {
            inputsMap.set(token.id, token)
            return true
        }
    })
}

const validateAndListInputsExpr = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    const inputs = listInputs(tokenizedExpressions)
    inputs.forEach(input => {
        if (input.type === 'signal') {
            throw new Error(`invalid signal token $v# for [expr]`)      
        }
    })
    return inputs
}

const validateAndListInputsExprTilde = (tokenizedExpressions: Array<Array<ExpressionToken>>) => {
    return listInputs(tokenizedExpressions)
}

const preprocessExpression = (args: PdJson.NodeArgs): Array<string> => {
    let expression = args.join(' ')

    // Get all Math functions from the expression and prefix them with `Math.`
    Object.getOwnPropertyNames(Math).forEach(funcName => {
        expression = expression.replaceAll(funcName, `Math.${funcName}`)
    })

    // Split the several outputs from the expression
    return expression.split(';')
        .map(expression => expression.trim())
}

const nodeImplementations: NodeImplementations = {
    'expr': {
        generateMessageReceivers,
        stateVariables,
        generateDeclarations,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            stdlib.commonsArrays,
        ],
    },
    'expr~': {
        generateMessageReceivers,
        stateVariables,
        generateDeclarations,
        generateLoop: loopExprTilde,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            stdlib.commonsArrays,
        ],
    },
}

const builders = {
    'expr': builderExpr,
    'expr~': builderExprTilde,
}

export { builders, nodeImplementations, NodeArguments }
