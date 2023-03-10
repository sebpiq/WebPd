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