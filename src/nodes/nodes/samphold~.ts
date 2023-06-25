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

interface NodeArguments {}
const stateVariables = {
    signalMemory: 1,
    controlMemory: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ state, macros: { Var }}) => `
    let ${Var(state.signalMemory, 'Float')} = 0
    let ${Var(state.controlMemory, 'Float')} = 0
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ ins, outs, state }) => `
    ${state.signalMemory} = ${outs.$0} = ${ins.$1} < ${state.controlMemory} ? ${ins.$0}: ${state.signalMemory}
    ${state.controlMemory} = ${ins.$1}
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': `
        if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'set'
        ) {
            ${state.signalMemory} = msg_readFloatToken(${globs.m}, 1)
            return

        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'reset'
        ) {
            ${state.controlMemory} = msg_readFloatToken(${globs.m}, 1)
            return

        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'reset'
        ) {
            ${state.controlMemory} = 1e20
            return
        }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    messages,
    declare,
}

export { builder, nodeImplementation, NodeArguments }