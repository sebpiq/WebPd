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

import { NodeImplementations } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { ftom, mtof } from '../global-code/funcs'

interface NodeArguments {}
const stateVariables = {}

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

// ------------------------------------------------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs~': { stateVariables, generateLoopInline: ({ ins }) => `Math.abs(${ins.$0})` },
    'cos~': { stateVariables, generateLoopInline: ({ ins }) => `Math.cos(${ins.$0} * 2 * Math.PI)` },
    'wrap~': { stateVariables, generateLoopInline: ({ ins }) => `(1 + (${ins.$0} % 1)) % 1` },
    'sqrt~': { stateVariables, generateLoopInline: ({ ins }) => `${ins.$0} >= 0 ? Math.pow(${ins.$0}, 0.5): 0` },
    'mtof~': { stateVariables, generateLoopInline: ({ ins }) => `mtof(${ins.$0})`, dependencies: [mtof] },
    'ftom~': { stateVariables, generateLoopInline: ({ ins }) => `ftom(${ins.$0})`, dependencies: [ftom] },
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