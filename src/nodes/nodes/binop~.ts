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
import { assertOptionalNumber } from '../validation'
import { pow } from '../global-code/funcs'
import { ast } from '@webpd/compiler'

interface NodeArguments {
    value: number
}

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

// ------------------------------- node implementation ------------------------------ //
const nodeImplementations: NodeImplementations = {
    '+~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'add_t',
        },
        loop: ({ ins }) => ast`${ins.$0} + ${ins.$1}`,
    },
    '-~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'sub_t',
        },
        loop: ({ ins }) => ast`${ins.$0} - ${ins.$1}`,
    },
    '*~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'mul_t',
        },
        loop: ({ ins }) => ast`${ins.$0} * ${ins.$1}`,
    },
    '/~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'div_t',
        },
        loop: ({ ins }) => ast`${ins.$1} !== 0 ? ${ins.$0} / ${ins.$1} : 0`,
    },
    'min~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'min_t',
        },
        loop: ({ ins }) => ast`Math.min(${ins.$0}, ${ins.$1})`,
    },
    'max~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'max_t',
        },
        loop: ({ ins }) => ast`Math.max(${ins.$0}, ${ins.$1})`,
    },
    'pow~': {
        flags: {
            isPureFunction: true,
            isLoopInline: true,
            alphaName: 'pow_t',
        },
        loop: ({ ins }) => ast`pow(${ins.$0}, ${ins.$1})`,
        dependencies: [pow],
    },
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

export { builders, nodeImplementations, NodeArguments }
