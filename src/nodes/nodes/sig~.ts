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

import { NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { coldFloatInlet } from '../standard-message-receivers'
import { ast, Class, Var } from '@webpd/compiler'

interface NodeArguments {
    initValue: number,
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //
const nodeImplementation: _NodeImplementation = {
    flags: {
        isPureFunction: true,
        isDspInline: true,
        alphaName: 'sig_t',
    },
    
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Float`, `currentValue`, args.initValue)
        ]),

    dsp: ({ state }) => 
        ast`${state}.currentValue`,

    messageReceivers: ({ state }, { msg }) => ({
        '0': coldFloatInlet(`${state}.currentValue`, msg),
    }),
}

export { builder, nodeImplementation, NodeArguments }