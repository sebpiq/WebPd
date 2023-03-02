/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalString } from '../nodes-shared-code/validation'
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
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {},
        isPullingSignal: true,
    }),
    rerouteMessageConnection: (inletId) => {
        if (inletId === '0') {
            return '0_message'
        }
        return undefined
    },
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
const loop: _NodeImplementation['loop'] = ({ ins, state }) => `
    addAssignSignalBus(${state.busName}, ${ins.$0})
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0_message': `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetBusName}(msg_readStringToken(${globs.m}, 1))
        return
    }
    `
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    loop,
    messages,
    stateVariables,
    declare,
    sharedCode: [ signalBuses ]
}

export { builder, nodeImplementation, NodeArguments }