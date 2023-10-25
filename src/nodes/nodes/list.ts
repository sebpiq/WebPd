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

import { Code, DspGraph, functional } from '@webpd/compiler'
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { bangUtils, msgUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'

interface NodeArguments {
    operation: string
    operationArgs: Array<DspGraph.NodeArgument>
}
const stateVariables = {
    currentList: 1,
    splitPoint: 1,
    funcSetSplitPoint: 1
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : implement missing list operations
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => {
        const operation = assertOptionalString(args[0]) || 'append'
        let operationArgs = args.slice(1)

        switch (operation) {
            case 'split':
                operationArgs = [assertOptionalNumber(args[1]) || 0]
                break

            case 'trim':
            case 'length':
                operationArgs = []
                break

            case 'append':
            case 'prepend':
                break

            case 'fromsymbol':
            case 'tosymbol':
            case 'store':
                throw new Error(`list operation ${operation} not implemented yet`)

            default: 
                throw new Error(`invalid list operation ${operation}`)
        }
        return {
            operation,
            operationArgs,
        }
    },
    build: ({ operation }) => {
        let inletCount = 0
        let outletCount = 0

        switch (operation) {
            case 'split':
                inletCount = 2
                outletCount = 3
                break

            case 'trim':
            case 'length':
                inletCount = 1
                outletCount = 1
                break

            case 'prepend':
            case 'append':
                inletCount = 2
                outletCount = 1
                break
        }

        return {
            inlets: functional.mapArray(
                functional.countTo(inletCount), 
                (i) => [`${i}`, { type: 'message', id: `${i}` }]),
            outlets: functional.mapArray(
                functional.countTo(outletCount),
                (i) => [`${i}`, { type: 'message', id: `${i}` }]
            ),
        }
    },
}

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({
    state,
    node: { args },
    macros: { Var, Func },
}) => {

    switch(args.operation) {
        case 'split': 
            return `
                let ${Var(state.splitPoint, 'Int')} = ${args.operationArgs[0]}

                function ${state.funcSetSplitPoint} ${Func([
                    Var('value', 'Float')
                ], 'void')} {
                    ${state.splitPoint} = toInt(value)
                }
            `

        case 'trim': 
        case 'length':
            return ``

        case 'append':
        case 'prepend':
            return `
                let ${Var(state.currentList, 'Message')} = msg_create([])
                {
                    const ${Var('template', 'MessageTemplate')} = [${
                        args.operationArgs.map((arg) => 
                            typeof arg === 'string' ? 
                                `MSG_STRING_TOKEN,${arg.length}`
                                : `MSG_FLOAT_TOKEN`).join(',')}]
        
                    ${state.currentList} = msg_create(template)
        
                    ${args.operationArgs.map((arg, i) => 
                        typeof arg === 'string' ? 
                            `msg_writeStringToken(${state.currentList}, ${i}, "${arg}")`
                            : `msg_writeFloatToken(${state.currentList}, ${i}, ${arg})`)}
                }
            `
        
        default: 
            throw Error(`unknown operation ${args.operation}`)
    }
}

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = ({ 
    snds, 
    globs, 
    state, 
    macros: { Var },
    node: { args } 
}) => {
    const prepareInMessage: Code = `const ${Var('inMessage', 'Message')} = msg_isBang(${globs.m}) ? msg_create([]): ${globs.m}`
    switch(args.operation) {
        case 'split':
            return {
                '0': `
                ${prepareInMessage}
                if (msg_getLength(inMessage) < ${state.splitPoint}) {
                    ${snds.$2}(${globs.m})
                    return
                } else if (msg_getLength(inMessage) === ${state.splitPoint}) {
                    ${snds.$1}(msg_bang())
                    ${snds.$0}(${globs.m})
                    return
                }
                const ${Var('outMessage1', 'Message')} = msg_slice(inMessage, ${state.splitPoint}, msg_getLength(inMessage))
                const ${Var('outMessage0', 'Message')} = msg_slice(inMessage, 0, ${state.splitPoint})
                ${snds.$1}(msg_getLength(outMessage1) === 0 ? msg_bang(): outMessage1)
                ${snds.$0}(msg_getLength(outMessage0) === 0 ? msg_bang(): outMessage0)
                return
                `,
        
                '1': coldFloatInletWithSetter(globs.m, state.funcSetSplitPoint),
            }

        case 'trim':
            return {
                '0': `
                ${snds.$0}(${globs.m})
                return
                `
            }

        case 'length':
            return {
                '0': `
                if (msg_isBang(${globs.m})) {
                    ${snds.$0}(msg_floats([0]))
                } else {
                    ${snds.$0}(msg_floats([toFloat(msg_getLength(${globs.m}))]))
                }
                return
                `
            }

        case 'append':
        case 'prepend':
            const appendPrependOutMessageCode = args.operation === 'prepend' ? 
                `msg_concat(${state.currentList}, ${globs.m})`
                : `msg_concat(${globs.m}, ${state.currentList})`
            
            return {
                '0': `
                if (msg_isBang(${globs.m})) {
                    ${snds.$0}(msg_getLength(${state.currentList}) === 0 ? msg_bang(): ${state.currentList})
                } else {
                    ${snds.$0}(msg_getLength(${state.currentList}) === 0 && msg_getLength(${globs.m}) === 0 ? msg_bang(): ${appendPrependOutMessageCode})
                }
                return
                `,

                '1': `
                ${prepareInMessage}
                ${state.currentList} = inMessage
                return
                `
            }

        case 'length':
        default: 
            throw new Error(`unknown list operation ${args.operation}`)
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateMessageReceivers,
    stateVariables,
    generateDeclarations,
    dependencies: [bangUtils, msgUtils]
}

export { builder, nodeImplementation, NodeArguments }
