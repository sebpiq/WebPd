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

import { NodeImplementation } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { messageBuses } from '../global-code/buses'
import { coreCode } from '@webpd/compiler'

interface NodeArguments {
    busName: string
}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {},
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    compilation: { codeVariableNames: { nodes } },
    node: { id, args },
}) => `
    commons_waitEngineConfigure(() => {
        msgBusSubscribe("${args.busName}", ${nodes[id].snds.$0})
    })
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    stateVariables,
    declare,
    globalCode: [messageBuses, coreCode.commonsWaitEngineConfigure],
}

export { builder, nodeImplementation, NodeArguments }
