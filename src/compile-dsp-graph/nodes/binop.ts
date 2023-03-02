/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import {
    Code,
    NodeImplementation,
    NodeImplementations,
} from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { bangUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'

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
    prepareLeftOp = 'value',
    prepareRightOp = 'value',
}: {
    generateOperation: (
        state: Parameters<_NodeImplementation['messages']>[0]['state']
    ) => Code
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
        sharedCode: [bangUtils],
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
    mod: makeNodeImplementation({
        prepareLeftOp: `value > 0 ? Math.floor(value): Math.ceil(value)`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly :
        // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
        // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
        generateOperation: (state) =>
            `${state.rightOp} !== 0 ? (${state.rightOp} + (${state.leftOp} % ${state.rightOp})) % ${state.rightOp}: 0`,
    }),
    pow: makeNodeImplementation({
        generateOperation: (state) =>
            `${state.leftOp} > 0 || (Math.round(${state.rightOp}) === ${state.rightOp}) ? Math.pow(${state.leftOp}, ${state.rightOp}): 0`,
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
    mod: makeBuilder(0),
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
