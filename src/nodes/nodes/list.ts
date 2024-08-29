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
import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString, assertOptionalNumber } from '../validation'
import { bangUtils, msgUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { AnonFunc, ConstVar, Func, Var, ast } from '@webpd/compiler'

interface NodeArguments {
    operation: string
    operationArgs: Array<DspGraph.NodeArgument>
}

type _NodeImplementation = NodeImplementation<NodeArguments>

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
const nodeImplementation: _NodeImplementation = {
    state: ({ ns }, { msg }) => 
        Class(ns.State, [
            Var(`Int`, `splitPoint`, 0),
            Var(msg.Message, `currentList`, `${msg.create}([])`),
        ]),

    initialization: ({ node: { args }, state }, { msg }) => ast`
        ${args.operation === 'split' ? 
            `${state}.splitPoint = ${args.operationArgs[0]}`: null}

        ${args.operation === 'append' || args.operation === 'prepend' ? ast` 
            {
                ${ConstVar(msg.Template, `template`, `[${
                    args.operationArgs.map((arg) => 
                        typeof arg === 'string' ? 
                            `${msg.STRING_TOKEN},${arg.length}`
                            : `${msg.FLOAT_TOKEN}`).join(',')}]`)}

                ${state}.currentList = ${msg.create}(template)

                ${args.operationArgs.map((arg, i) => 
                    typeof arg === 'string' ? 
                        `${msg.writeStringToken}(${state}.currentList, ${i}, "${arg}")`
                        : `${msg.writeFloatToken}(${state}.currentList, ${i}, ${arg})`)}
            }
        `: null}
    `,

    messageReceivers: (
        { 
            ns,
            snds, 
            state,
            node: { args } 
        }, {
            bangUtils,
            msgUtils,
            msg,
        }
    ) => {
        const prepareInMessage = ConstVar(msg.Message, `inMessage`, `${bangUtils.isBang}(m) ? ${msg.create}([]): m`)
        switch(args.operation) {
            case 'split':
                return {
                    '0': AnonFunc([Var(msg.Message, `m`)])`
                        ${prepareInMessage}
                        if (${msg.getLength}(inMessage) < ${state}.splitPoint) {
                            ${snds.$2}(m)
                            return
                        } else if (${msg.getLength}(inMessage) === ${state}.splitPoint) {
                            ${snds.$1}(${bangUtils.bang}())
                            ${snds.$0}(m)
                            return
                        }
                        ${ConstVar(msg.Message, `outMessage1`, `${msgUtils.slice}(inMessage, ${state}.splitPoint, ${msg.getLength}(inMessage))`)}
                        ${ConstVar(msg.Message, `outMessage0`, `${msgUtils.slice}(inMessage, 0, ${state}.splitPoint)`)}
                        ${snds.$1}(${msg.getLength}(outMessage1) === 0 ? ${bangUtils.bang}(): outMessage1)
                        ${snds.$0}(${msg.getLength}(outMessage0) === 0 ? ${bangUtils.bang}(): outMessage0)
                        return
                    `,
            
                    '1': coldFloatInletWithSetter(ns.setSplitPoint, state, msg),
                }
    
            case 'trim':
                return {
                    '0': AnonFunc([Var(msg.Message, `m`)])`
                        ${snds.$0}(m)
                        return
                    `
                }
    
            case 'length':
                return {
                    '0': AnonFunc([Var(msg.Message, `m`)])`
                        if (${bangUtils.isBang}(m)) {
                            ${snds.$0}(${msg.floats}([0]))
                        } else {
                            ${snds.$0}(${msg.floats}([toFloat(${msg.getLength}(m))]))
                        }
                        return
                    `
                }
    
            case 'append':
            case 'prepend':
                const appendPrependOutMessageCode = args.operation === 'prepend' ? 
                    `${msgUtils.concat}(${state}.currentList, m)`
                    : `${msgUtils.concat}(m, ${state}.currentList)`
                
                return {
                    '0': AnonFunc([Var(msg.Message, `m`)])`
                        if (${bangUtils.isBang}(m)) {
                            ${snds.$0}(${msg.getLength}(${state}.currentList) === 0 ? ${bangUtils.bang}(): ${state}.currentList)
                        } else {
                            ${snds.$0}(${msg.getLength}(${state}.currentList) === 0 && ${msg.getLength}(m) === 0 ? ${bangUtils.bang}(): ${appendPrependOutMessageCode})
                        }
                        return
                    `,
    
                    '1': AnonFunc([Var(msg.Message, `m`)])`
                        ${prepareInMessage}
                        ${state}.currentList = inMessage
                        return
                    `
                }
    
            case 'length':
            default: 
                throw new Error(`unknown list operation ${args.operation}`)
        }
    },

    core: ({ ns }) => 
        Sequence([
            Func(ns.setSplitPoint, [
                Var(ns.State, `state`),
                Var(`Float`, `value`),
            ], 'void')`
                state.splitPoint = toInt(value)
            `
        ]),

    dependencies: [
        bangUtils, 
        msgUtils, 
    ]
}

export { builder, nodeImplementation, NodeArguments }
