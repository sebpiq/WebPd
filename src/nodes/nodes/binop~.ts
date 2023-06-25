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
    CodeVariableName,
    NodeImplementation,
    NodeImplementations,
    SharedCodeGenerator,
} from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { pow } from '../nodes-shared-code/funcs'

interface NodeArguments { value: number }
const stateVariables = {
    leftOp: 1,
    rightOp: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

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
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection(inletId, nodeArgs) {
        if (inletId === '0') {
            return { initialSignalValue: 0 }
        }
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.value }
        }
        return undefined
    },
})

const makeNodeImplementation = ({
    generateOperation,
    sharedCode = [],
}: {
    sharedCode?: Array<SharedCodeGenerator>,
    generateOperation: (leftOp: CodeVariableName, rightOp: CodeVariableName) => Code,
}): _NodeImplementation => {
    const loop: _NodeImplementation['loop'] = ({ ins, outs }) =>
        `${outs.$0} = ${generateOperation(ins.$0, ins.$1)}`

    return { loop, stateVariables, sharedCode }
}

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    '+~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `${leftOp} + ${rightOp}` }),
    '-~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `${leftOp} - ${rightOp}` }),
    '*~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `${leftOp} * ${rightOp}` }),
    '/~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `${rightOp} !== 0 ? ${leftOp} / ${rightOp} : 0` }),
    'min~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `Math.min(${leftOp}, ${rightOp})` }),
    'max~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `Math.max(${leftOp}, ${rightOp})` }),
    'pow~': makeNodeImplementation({ generateOperation: (leftOp, rightOp) => `pow(${leftOp}, ${rightOp})`, sharedCode: [pow] }),
}

const builders = {
    '+~': makeBuilder(0),
    '-~': makeBuilder(0),
    '*~': makeBuilder(0),
    '/~': makeBuilder(0),
    'min~': makeBuilder(0),
    'max~': makeBuilder(0),
    'pow~': makeBuilder(0),
}

export { 
    builders,
    nodeImplementations,
    NodeArguments,
}
