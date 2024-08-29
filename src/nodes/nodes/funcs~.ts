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
import { ast } from '@webpd/compiler'

interface NodeArguments {}

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

// ---------------------------- node implementation -------------------------- //
const nodeImplementations: NodeImplementations = {
    'abs~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'abs_t',
        },
        dsp: ({ ins }) => ast`Math.abs(${ins.$0})`,
    },
    'cos~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'cos_t',
        },
        dsp: ({ ins }) => ast`Math.cos(${ins.$0} * 2 * Math.PI)`,
    },
    'wrap~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'wrap_t',
        },
        dsp: ({ ins }) => ast`(1 + (${ins.$0} % 1)) % 1`,
    },
    'sqrt~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'sqrt_t',
        },
        dsp: ({ ins }) =>
            ast`${ins.$0} >= 0 ? Math.pow(${ins.$0}, 0.5): 0`,
    },
    'mtof~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'mtof_t',
        },
        dsp: ({ ins }, { funcs }) => ast`${funcs.mtof}(${ins.$0})`,
        dependencies: [mtof],
    },
    'ftom~': {
        flags: {
            isPureFunction: true,
            isDspInline: true,
            alphaName: 'ftom_t',
        },
        dsp: ({ ins }, { funcs }) => ast`${funcs.ftom}(${ins.$0})`,
        dependencies: [ftom],
    },
}

const builders = {
    'abs~': builder,
    'cos~': builder,
    'wrap~': builder,
    'sqrt~': builder,
    'mtof~': builder,
    'ftom~': builder,
}

export { builders, nodeImplementations, NodeArguments }
