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
import { coldStringInlet } from '../standard-message-receivers'
import { coreCode } from '@webpd/compiler'

interface NodeArguments {
    busName: string
}
const stateVariables = {
    busName: 1,
}
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
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    macros: { Var },
    node: { args },
}) => `
    let ${Var(state.busName, 'string')} = "${args.busName}"
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    state,
    globs,
}) => ({
    '0': `
    msgBusPublish(${state.busName}, ${globs.m})
    return
    `,

    '1': coldStringInlet(globs.m, state.busName)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    stateVariables,
    declare,
    messages,
    globalCode: [messageBuses, coreCode.commonsWaitEngineConfigure],
}

export { builder, nodeImplementation, NodeArguments }
