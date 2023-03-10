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
    Code,
    NodeImplementation,
    NodeImplementations,
    SharedCodeGenerator,
} from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { pow } from '../nodes-shared-code/funcs'

interface NodeArguments {
    value: number
}
const stateVariables = {
    leftOp: 1,
    rightOp: 1,
    funcSetRightOp: 1,
    funcSetLeftOp: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

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

const makeNodeImplementation = ({
    generateOperation,
    sharedCode = [],
    prepareLeftOp = 'value',
    prepareRightOp = 'value',
}: {
    generateOperation: (
        state: Parameters<_NodeImplementation['messages']>[0]['state']
    ) => Code
    sharedCode?: Array<SharedCodeGenerator>,
    prepareLeftOp?: Code
    prepareRightOp?: Code
}): _NodeImplementation => {
    // ------------------------------ declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({
        state,
        macros: { Var, Func },
        node: { args },
    }) => `
        let ${Var(state.leftOp, 'Float')} = 0
        let ${Var(state.rightOp, 'Float')} = 0

        const ${state.funcSetLeftOp} = ${Func(
        [Var('value', 'Float')],
        'void'
    )} => {
            ${state.leftOp} = ${prepareLeftOp}
        }

        const ${state.funcSetRightOp} = ${Func(
        [Var('value', 'Float')],
        'void'
    )} => {
            ${state.rightOp} = ${prepareRightOp}
        }

        ${state.funcSetLeftOp}(0)
        ${state.funcSetRightOp}(${args.value})
    `

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({
        state,
        globs,
        snds,
    }) => ({
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            ${state.funcSetLeftOp}(msg_readFloatToken(${globs.m}, 0))
            ${snds.$0}(msg_floats([${generateOperation(state)}]))
            return
        
        } else if (msg_isBang(${globs.m})) {
            ${snds.$0}(msg_floats([${generateOperation(state)}]))
            return
        }
        `,

        '1': coldFloatInletWithSetter(globs.m, state.funcSetRightOp),
    })

    return {
        declare,
        messages,
        stateVariables,
        sharedCode: [bangUtils, ...sharedCode],
    }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    '+': makeNodeImplementation({
        generateOperation: (state) => `${state.leftOp} + ${state.rightOp}`,
    }),
    '-': makeNodeImplementation({
        generateOperation: (state) => `${state.leftOp} - ${state.rightOp}`,
    }),
    '*': makeNodeImplementation({
        generateOperation: (state) => `${state.leftOp} * ${state.rightOp}`,
    }),
    '/': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.rightOp} !== 0 ? ${state.leftOp} / ${state.rightOp}: 0`,
    }),
    'max': makeNodeImplementation({
        generateOperation: (state) => `Math.max(${state.leftOp}, ${state.rightOp})`,
    }),
    'min': makeNodeImplementation({
        generateOperation: (state) => `Math.min(${state.leftOp}, ${state.rightOp})`,
    }),
    mod: makeNodeImplementation({
        prepareLeftOp: `value > 0 ? Math.floor(value): Math.ceil(value)`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly :
        // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
        // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
        generateOperation: (state) =>
            `${state.rightOp} !== 0 ? (${state.rightOp} + (${state.leftOp} % ${state.rightOp})) % ${state.rightOp}: 0`,
    }),
    // Legacy modulo
    '%': makeNodeImplementation({
        generateOperation: (state) => `${state.leftOp} % ${state.rightOp}`,
    }),
    pow: makeNodeImplementation({
        generateOperation: (state) => `pow(${state.leftOp}, ${state.rightOp})`,
        sharedCode: [pow],
    }),
    '||': makeNodeImplementation({
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) =>
            `${state.leftOp} || ${state.rightOp} ? 1: 0`,
    }),
    '&&': makeNodeImplementation({
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) =>
            `${state.leftOp} && ${state.rightOp} ? 1: 0`,
    }),
    '>': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} > ${state.rightOp} ? 1: 0`,
    }),
    '>=': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} >= ${state.rightOp} ? 1: 0`,
    }),
    '<': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} < ${state.rightOp} ? 1: 0`,
    }),
    '<=': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} <= ${state.rightOp} ? 1: 0`,
    }),
    '==': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} == ${state.rightOp} ? 1: 0`,
    }),
    '!=': makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} != ${state.rightOp} ? 1: 0`,
    }),
}

const builders = {
    '+': makeBuilder(0),
    '-': makeBuilder(0),
    '*': makeBuilder(1),
    '/': makeBuilder(1),
    'max': makeBuilder(0),
    'min': makeBuilder(1),
    mod: makeBuilder(0),
    '%': makeBuilder(0),
    pow: makeBuilder(0),
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
