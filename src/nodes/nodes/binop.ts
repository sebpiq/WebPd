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

import {
    NodeImplementation,
    NodeImplementations,
    GlobalCodeGenerator,
} from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../global-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { pow } from '../global-code/funcs'
import { AnonFunc, ast, Class, ConstVar, Func, Sequence, Var } from '@webpd/compiler'
import { Code } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    value: number
}
type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const makeBuilder = (defaultValue: number): NodeBuilder<NodeArguments> => ({
    translateArgs: (pdNode) => {
        const value = assertOptionalNumber(pdNode.args[0])
        return {
            value: value !== undefined ? value : defaultValue,
        }
    },
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
})

// ------------------------------- node implementation ------------------------------ //
const variableNamesBinopBase = generateVariableNamesNodeType('binopbase')

const makeNodeImplementation = ({
    operationName,
    generateOperation,
    dependencies = [],
    prepareLeftOp,
    prepareRightOp,
}: {
    operationName: string,
    generateOperation: (
        state: Parameters<
            _NodeImplementation['messageReceivers']
        >[0]['state']
    ) => Code
    dependencies?: Array<GlobalCodeGenerator>
    prepareLeftOp?: Code
    prepareRightOp?: Code
}): _NodeImplementation => {
    
    const variableNames = generateVariableNamesNodeType(operationName, ['setLeft', 'setRight'])

    return {
        initialization: ({ state, node: { args } }) => ast`
        ${ConstVar(variableNamesBinopBase.stateClass, state, `{
                leftOp: 0,
                rightOp: 0,
            }`)}
            ${variableNames.setLeft}(${state}, 0)
            ${variableNames.setRight}(${state}, ${args.value})
        `,

        messageReceivers: ({ state, snds }) => ({
            '0': AnonFunc([Var('Message', 'm')])`
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${variableNames.setLeft}(${state}, msg_readFloatToken(m, 0))
                    ${snds.$0}(msg_floats([${generateOperation(state)}]))
                    return
                
                } else if (msg_isBang(m)) {
                    ${snds.$0}(msg_floats([${generateOperation(state)}]))
                    return
                }
            `,

            '1': coldFloatInletWithSetter(variableNames.setRight, state),
        }),

        dependencies: [
            bangUtils, 
            ...dependencies,
            // Shared code for all operators
            () => Sequence([
                Class(variableNamesBinopBase.stateClass, [
                    Var('Float', 'leftOp'), 
                    Var('Float', 'rightOp')
                ])
            ]),

            // Operator-dependent code
            () => Sequence([
                Func(variableNames.setLeft, [
                    Var(variableNamesBinopBase.stateClass, 'state'),
                    Var('Float', 'value'),
                ], 'void')`
                    state.leftOp = ${prepareLeftOp ? prepareLeftOp: 'value'}
                `,

                Func(variableNames.setRight, [
                    Var(variableNamesBinopBase.stateClass, 'state'),
                    Var('Float', 'value'),
                ], 'void')`
                    state.rightOp = ${prepareRightOp ? prepareRightOp: 'value'}
                `,
            ]),
        ],
    }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    '+': makeNodeImplementation({
        operationName: 'add',
        generateOperation: (state) => `${state}.leftOp + ${state}.rightOp`,
    }),
    '-': makeNodeImplementation({
        operationName: 'sub',
        generateOperation: (state) => `${state}.leftOp - ${state}.rightOp`,
    }),
    '*': makeNodeImplementation({
        operationName: 'mul',
        generateOperation: (state) => `${state}.leftOp * ${state}.rightOp`,
    }),
    '/': makeNodeImplementation({
        operationName: 'div',
        generateOperation: (state) =>
            `${state}.rightOp !== 0 ? ${state}.leftOp / ${state}.rightOp: 0`,
    }),
    max: makeNodeImplementation({
        operationName: 'max',
        generateOperation: (state) =>
            `Math.max(${state}.leftOp, ${state}.rightOp)`,
    }),
    min: makeNodeImplementation({
        operationName: 'min',
        generateOperation: (state) =>
            `Math.min(${state}.leftOp, ${state}.rightOp)`,
    }),
    mod: makeNodeImplementation({
        operationName: 'mod',
        prepareLeftOp: `value > 0 ? Math.floor(value): Math.ceil(value)`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly :
        // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
        // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
        generateOperation: (state) =>
            `${state}.rightOp !== 0 ? (${state}.rightOp + (${state}.leftOp % ${state}.rightOp)) % ${state}.rightOp: 0`,
    }),
    // Legacy modulo
    '%': makeNodeImplementation({
        operationName: 'modlegacy',
        generateOperation: (state) => `${state}.leftOp % ${state}.rightOp`,
    }),
    pow: makeNodeImplementation({
        operationName: 'pow',
        generateOperation: (state) => `pow(${state}.leftOp, ${state}.rightOp)`,
        dependencies: [pow],
    }),
    log: makeNodeImplementation({
        operationName: 'log',
        generateOperation: (state) =>
            `Math.log(${state}.leftOp) / Math.log(${state}.rightOp)`,
    }),
    '||': makeNodeImplementation({
        operationName: 'or',
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) =>
            `${state}.leftOp || ${state}.rightOp ? 1: 0`,
    }),
    '&&': makeNodeImplementation({
        operationName: 'and',
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) =>
            `${state}.leftOp && ${state}.rightOp ? 1: 0`,
    }),
    '>': makeNodeImplementation({
        operationName: 'gt',
        generateOperation: (state) =>
            `${state}.leftOp > ${state}.rightOp ? 1: 0`,
    }),
    '>=': makeNodeImplementation({
        operationName: 'gte',
        generateOperation: (state) =>
            `${state}.leftOp >= ${state}.rightOp ? 1: 0`,
    }),
    '<': makeNodeImplementation({
        operationName: 'lt',
        generateOperation: (state) =>
            `${state}.leftOp < ${state}.rightOp ? 1: 0`,
    }),
    '<=': makeNodeImplementation({
        operationName: 'lte',
        generateOperation: (state) =>
            `${state}.leftOp <= ${state}.rightOp ? 1: 0`,
    }),
    '==': makeNodeImplementation({
        operationName: 'eq',
        generateOperation: (state) =>
            `${state}.leftOp == ${state}.rightOp ? 1: 0`,
    }),
    '!=': makeNodeImplementation({
        operationName: 'neq',
        generateOperation: (state) =>
            `${state}.leftOp != ${state}.rightOp ? 1: 0`,
    }),
}

const builders = {
    '+': makeBuilder(0),
    '-': makeBuilder(0),
    '*': makeBuilder(1),
    '/': makeBuilder(1),
    max: makeBuilder(0),
    min: makeBuilder(1),
    mod: makeBuilder(0),
    '%': makeBuilder(0),
    pow: makeBuilder(0),
    log: makeBuilder(Math.E),
    '||': makeBuilder(0),
    '&&': makeBuilder(0),
    '>': makeBuilder(0),
    '>=': makeBuilder(0),
    '<': makeBuilder(0),
    '<=': makeBuilder(0),
    '==': makeBuilder(0),
    '!=': makeBuilder(0),
}

export { builders, nodeImplementations, NodeArguments }
