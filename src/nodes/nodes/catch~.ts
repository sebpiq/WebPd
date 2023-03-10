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

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { signalBuses } from '../nodes-shared-code/buses'

interface NodeArguments {
    busName: string,
}
const stateVariables = {
    busName: 1,
    funcSetBusName: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {},
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ 
    state, 
    node: { args }, 
    macros: { Var, Func }
}) => `
    let ${Var(state.busName, 'string')} = ""

    const ${state.funcSetBusName} = ${Func([
        Var('busName', 'string')
    ], 'void')} => {
        if (busName.length) {
            ${state.busName} = busName
            resetSignalBus(${state.busName})
        }
    }

    ${state.funcSetBusName}("${args.busName}")
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({ outs, state }) => `
    ${outs.$0} = readSignalBus(${state.busName})
    resetSignalBus(${state.busName})
`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    stateVariables,
    declare,
    sharedCode: [ signalBuses ]
}

export { builder, nodeImplementation, NodeArguments }