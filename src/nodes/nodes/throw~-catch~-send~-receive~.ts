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

import { NodeImplementation, NodeImplementations } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { signalBuses } from '../global-code/buses'
import { AnonFunc, Class, Func, Sequence, Var, ast } from '@webpd/compiler'
import { VariableName } from '@webpd/compiler/src/ast/types'

interface NodeArguments {
    busName: string,
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builderThrow: NodeBuilder<NodeArguments> = {
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' }
        }
        return undefined
    },
}

const builderReceive: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
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


const builderSend: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
        },
        outlets: {},
        isPullingSignal: true,
    }),
}

const builderCatch: NodeBuilder<NodeArguments> = {
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

// ------------------------------- node implementation ------------------------------ //
const sharedCore = (ns: { [name: string]: VariableName }) =>
    Sequence([
        Func(ns.setBusName!, [
            Var(ns.State!, 'state'), Var('string', 'busName')
        ], 'void')`
            if (busName.length) {
                state.busName = busName
                resetSignalBus(state.busName)
            }
        `,
    ])

const sharedNodeImplementation: _NodeImplementation = {
    state: ({ ns }) =>
        Class(ns.State!, [Var('string', 'busName', '""')]),

    initialization: ({ ns, node: { args }, state }) =>
        ast`
        ${ns.setBusName!}(${state}, "${args.busName}")
    `,
}

// --------------------------------- node implementation - throw~ ---------------------------------- //
const nodeImplementationThrow: _NodeImplementation = {
    ...sharedNodeImplementation,

    flags: {
        alphaName: 'throw_t',
    },

    dsp: ({ ins, state }) => ast`
        addAssignSignalBus(${state}.busName, ${ins.$0})
    `,

    messageReceivers: ({ ns, state }) => ({
        '0_message': AnonFunc([ Var('Message', 'm') ], 'void')`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${ns.setBusName!}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),

    core: ({ ns }) => 
        sharedCore(ns),

    dependencies: [ 
        signalBuses,
    ]
}

// --------------------------------- node implementation - catch~ ---------------------------------- //
const nodeImplementationCatch: _NodeImplementation = {
    ...sharedNodeImplementation,

    flags: {
        alphaName: 'catch_t',
    },

    dsp: ({
        outs,
        state,
    }) => ast`
        ${outs.$0} = readSignalBus(${state}.busName)
        resetSignalBus(${state}.busName)
    `,

    core: ({ ns }) => 
        sharedCore(ns),

    dependencies: [
        signalBuses,
    ],
}

// --------------------------------- node implementation - send~ ---------------------------------- //
const nodeImplementationSend: _NodeImplementation = {
    ...sharedNodeImplementation,

    flags: {
        alphaName: 'send_t',
    },

    dsp: ({ state, ins }) => ast`
        setSignalBus(${state}.busName, ${ins.$0})
    `,

    core: ({ ns }) => 
        sharedCore(ns),

    dependencies: [
        signalBuses,
    ],
}

// --------------------------------- node implementation - receive~ ---------------------------------- //
const nodeImplementationReceive: _NodeImplementation = {
    ...sharedNodeImplementation,

    flags: {
        alphaName: 'receive_t',
        isDspInline: true,
    },

    dsp: ({ state }) => 
        ast`readSignalBus(${state}.busName)`,
    
    messageReceivers: ({ ns, state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${ns.setBusName!}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),

    core: ({ ns }) => 
        sharedCore(ns),

    dependencies: [
        signalBuses,
    ]
}

// -------------------------------------------------------------------------------------------- //
const builders = {
    'throw~': builderThrow,
    'catch~': builderCatch,
    'send~': builderSend,
    'receive~': builderReceive,
}

const nodeImplementations: NodeImplementations = {
    'throw~': nodeImplementationThrow,
    'catch~': nodeImplementationCatch,
    'send~': nodeImplementationSend,
    'receive~': nodeImplementationReceive,
}

export { nodeImplementations, builders, NodeArguments }

