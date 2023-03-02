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

import { DspGraph } from '@webpd/compiler-js'
import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { coldFloatInlet } from '../nodes-shared-code/standard-message-receivers'

interface NodeArguments {
    minValue: number,
    maxValue: number,
}
const stateVariables = {
    minValue: 1,
    maxValue: 1,
    inputValue: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        minValue: assertOptionalNumber(args[0]) || 0,
        maxValue: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        return undefined
    },
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ node: { args }, state, macros: { Var }}) => `
    let ${Var(state.inputValue, 'Float')} = 0
    let ${Var(state.minValue, 'Float')} = ${args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${args.maxValue}
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, outs, state, node }) => `
    ${outs.$0} = Math.max(Math.min(${state.maxValue}, ${_hasSignalInput(node) ? ins.$0: state.inputValue}), ${state.minValue})
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': coldFloatInlet(globs.m, state.inputValue),
    '1': coldFloatInlet(globs.m, state.minValue),
    '2': coldFloatInlet(globs.m, state.maxValue),
})

// ------------------------------------------------------------------- //
const _hasSignalInput = (node: DspGraph.Node<NodeArguments>) =>
    node.sources['0'] && node.sources['0'].length

const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
}

export { builder, nodeImplementation, NodeArguments }