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

import { DspGraph } from '@webpd/compiler-js'
import { Code, NodeImplementation, NodeImplementations } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import {
    coldFloatInlet,
} from '../standard-message-receivers'

interface NodeArguments {
    initCoeffRe: number
    initCoeffIm: number
}
const stateVariables = {
    inputIm: 1,
    coeffRe: 1,
    coeffIm: 1,
    lastInputRe: 1,
    lastInputIm: 1,
    lastOutputRe: 1,
    lastOutputIm: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : tests + cleaner implementations
// TODO : separate cfilters with lastInputRe lastInputIm from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initCoeffRe: assertOptionalNumber(args[0]) || 0,
        initCoeffIm: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'signal', id: '1' },
            '1_message': { type: 'message', id: '1_message' },
            '2': { type: 'signal', id: '2' },
            '2_message': { type: 'message', id: '2_message' },
            '3': { type: 'signal', id: '3' },
            '3_message': { type: 'message', id: '3_message' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        if (inletId === '1') {
            return '1_message'
        }
        if (inletId === '2') {
            return '2_message'
        }
        if (inletId === '3') {
            return '3_message'
        }
        return undefined
    },
}

const makeNodeImplementation = ({
    generateOperationRe,
    generateOperationIm,
}: {
    generateOperationRe: (
        inputRe: Code,
        inputIm: Code,
        coeffRe: Code,
        coeffIm: Code,
        lastOutputRe: Code,
        lastOutputIm: Code,
        lastInputRe: Code,
        lastInputIm: Code,
    ) => Code,
    generateOperationIm: (
        inputRe: Code,
        inputIm: Code,
        coeffRe: Code,
        coeffIm: Code,
        lastOutputRe: Code,
        lastOutputIm: Code,
        lastInputRe: Code,
        lastInputIm: Code,
    ) => Code,
}): _NodeImplementation => {

    // ------------------------------- declare ------------------------------ //
    const declare: _NodeImplementation['declare'] = ({
        state,
        node: { args },
        macros: { Var },
    }) => `
        let ${Var(state.inputIm, 'Float')} = 0
        let ${Var(state.coeffRe, 'Float')} = ${args.initCoeffRe}
        let ${Var(state.coeffIm, 'Float')} = ${args.initCoeffIm}
        let ${Var(state.lastOutputRe, 'Float')} = 0
        let ${Var(state.lastOutputIm, 'Float')} = 0
        let ${Var(state.lastInputRe, 'Float')} = 0
        let ${Var(state.lastInputIm, 'Float')} = 0
    `

    // ------------------------------- loop ------------------------------ //
    const loop: _NodeImplementation['loop'] = ({ node, ins, state, outs }) => `
        ${outs.$0} = ${generateOperationRe(
            ins.$0, 
            _hasSignalInput('1', node) ? ins.$1: state.inputIm, 
            _hasSignalInput('2', node) ? ins.$2: state.coeffRe,
            _hasSignalInput('3', node) ? ins.$3: state.coeffIm,
            state.lastOutputRe, 
            state.lastOutputIm, 
            state.lastInputRe, 
            state.lastInputIm
        )}
        ${state.lastOutputIm} = ${outs.$1} = ${generateOperationIm(
            ins.$0, 
            _hasSignalInput('1', node) ? ins.$1: state.inputIm, 
            _hasSignalInput('2', node) ? ins.$2: state.coeffRe,
            _hasSignalInput('3', node) ? ins.$3: state.coeffIm,
            state.lastOutputRe, 
            state.lastOutputIm, 
            state.lastInputRe, 
            state.lastInputIm
        )}
        ${state.lastOutputRe} = ${outs.$0}
        ${state.lastInputRe} = ${ins.$0}
        ${state.lastInputIm} = ${_hasSignalInput('1', node) ? ins.$1: state.inputIm}
    `

    // ------------------------------- messages ------------------------------ //
    const messages: _NodeImplementation['messages'] = ({ globs, state }) => ({
        '1_message': coldFloatInlet(globs.m, state.inputIm),
        '2_message': coldFloatInlet(globs.m, state.coeffRe),
        '3_message': coldFloatInlet(globs.m, state.coeffIm),
    })

    return {
        loop,
        stateVariables,
        messages,
        declare,
    }
}

// ------------------------------------------------------------------- //
const _hasSignalInput = (inletId: DspGraph.PortletId, node: DspGraph.Node<NodeArguments>) =>
    node.sources[inletId] && node.sources[inletId].length

const builders = {
    'cpole~': builder,
    'czero~': builder,
}

const nodeImplementations: NodeImplementations = {
    'cpole~': makeNodeImplementation({
        // *outre++ = nextre + lastre * coefre - lastim * coefim
        generateOperationRe: (
            inputRe,
            _,
            coeffRe,
            coeffIm,
            lastOutputRe,
            lastOutputIm,
        ) => `${inputRe} + ${lastOutputRe} * ${coeffRe} - ${lastOutputIm} * ${coeffIm}`,
        // *outim++ = nextim + lastre * coefim + lastim * coefre;
        generateOperationIm: (
            _,
            inputIm,
            coeffRe,
            coeffIm,
            lastOutputRe,
            lastOutputIm,
        ) => `${inputIm} + ${lastOutputRe} * ${coeffIm} + ${lastOutputIm} * ${coeffRe}`,
    }),
    'czero~': makeNodeImplementation({
        // *outre++ = nextre - lastre * coefre + lastim * coefim;
        generateOperationRe: (
            inputRe,
            _,
            coeffRe,
            coeffIm,
            __,
            ___,
            lastInputRe,
            lastInputIm,
        ) => `${inputRe} - ${lastInputRe} * ${coeffRe} + ${lastInputIm} * ${coeffIm}`,
        // *outim++ = nextim - lastre * coefim - lastim * coefre;
        generateOperationIm: (
            _,
            inputIm,
            coeffRe,
            coeffIm,
            __,
            ___,
            lastInputRe,
            lastInputIm,
        ) => `${inputIm} - ${lastInputRe} * ${coeffIm} - ${lastInputIm} * ${coeffRe}`,
    }),
}

export { builders, nodeImplementations, NodeArguments }
