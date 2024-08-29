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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { AnonFunc, Class, Func, Sequence, Var } from '@webpd/compiler'

interface NodeArguments {
    isClosed: boolean
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        isClosed: (assertOptionalNumber(args[0]) || 0) === 0
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- node implementation ------------------------------ //

const nodeImplementation: _NodeImplementation = {
    state: ({ node: { args }, ns }) => 
        Class(ns.State, [
            Var(`Float`, `isClosed`, args.isClosed ? `true`: `false`)
        ]),

    messageReceivers: ({ ns, snds, state }, { msg }) => ({
        '0': AnonFunc([Var(msg.Message, `m`)])`
            if (!${state}.isClosed) {
                ${snds.$0}(m)
            }
            return
        `,

        '1': coldFloatInletWithSetter(ns.setIsClosed, state, msg),
    }),

    core: ({ ns }) => 
        Sequence([
            Func(ns.setIsClosed, [
                Var(ns.State, `state`),
                Var(`Float`, `value`),
            ], 'void')`
                state.isClosed = (value === 0)
            `
        ]),
}

export { builder, nodeImplementation, NodeArguments }
