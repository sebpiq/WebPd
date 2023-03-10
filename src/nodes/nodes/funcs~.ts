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

import { Code, NodeImplementation, NodeImplementations, SharedCodeGenerator } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { ftom, mtof } from '../nodes-shared-code/funcs'

interface NodeArguments {}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- loop ------------------------------ //
const makeNodeImplementation = ({
    generateOperation,
    sharedCode = [],
}: {
    generateOperation: (input: Code) => Code,
    sharedCode?: Array<SharedCodeGenerator>
}): _NodeImplementation => {
    const loop: _NodeImplementation['loop'] = ({ ins, outs }) => `
        ${outs.$0} = ${generateOperation(ins.$0)}
    `

    return { loop, stateVariables, sharedCode }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs~': makeNodeImplementation({ generateOperation: (input) => `Math.abs(${input})` }),
    'cos~': makeNodeImplementation({ generateOperation: (input) => `Math.cos(${input} * 2 * Math.PI)` }),
    'wrap~': makeNodeImplementation({ generateOperation: (input) => `(1 + (${input} % 1)) % 1` }),
    'sqrt~': makeNodeImplementation({ generateOperation: (input) => `${input} >= 0 ? Math.pow(${input}, 0.5): 0` }),
    'mtof~': makeNodeImplementation({ generateOperation: (input) => `mtof(${input})`, sharedCode: [mtof] }),
    'ftom~': makeNodeImplementation({ generateOperation: (input) => `ftom(${input})`, sharedCode: [ftom] }),
}

const builders = {
    'abs~': builder,
    'cos~': builder,
    'wrap~': builder,
    'sqrt~': builder,
    'mtof~': builder,
    'ftom~': builder,
}

export { 
    builders,
    nodeImplementations,
    NodeArguments,
}