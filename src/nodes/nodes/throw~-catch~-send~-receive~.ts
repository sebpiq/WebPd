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
import { generateVariableNamesNodeType } from '../variable-names'
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
const sharedCore = (
    variableNames: ReturnType<typeof generateVariableNamesNodeType>,
    stateClassName: VariableName
) =>
    Sequence([
        Func(
            variableNames.setBusName,
            [Var(stateClassName, 'state'), Var('string', 'busName')],
            'void'
        )`
            if (busName.length) {
                state.busName = busName
                resetSignalBus(state.busName)
            }
        `,
    ])

const sharedNodeImplementation = (
    variableNames: ReturnType<typeof generateVariableNamesNodeType>
): _NodeImplementation => {
    return {
        state: ({ stateClassName }) =>
            Class(stateClassName, [Var('string', 'busName', '""')]),

        initialization: ({ node: { args }, state }) =>
            ast`
            ${variableNames.setBusName}(${state}, "${args.busName}")
        `,
    }
}

// --------------------------------- node implementation - throw~ ---------------------------------- //
const variableNamesThrow = generateVariableNamesNodeType('throw_t', [
    'setBusName'
])

const nodeImplementationThrow: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesThrow),

    flags: {
        alphaName: 'throw_t',
    },

    dsp: ({ ins, state }) => ast`
        addAssignSignalBus(${state}.busName, ${ins.$0})
    `,

    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc([ Var('Message', 'm') ], 'void')`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNamesThrow.setBusName}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),

    core: ({ stateClassName }) => 
        sharedCore(variableNamesThrow, stateClassName),

    dependencies: [ 
        signalBuses,
    ]
}

// --------------------------------- node implementation - catch~ ---------------------------------- //
const variableNamesCatch = generateVariableNamesNodeType('catch_t', [
    'setBusName'
])

const nodeImplementationCatch: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesCatch),

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

    core: ({ stateClassName }) => 
        sharedCore(variableNamesCatch, stateClassName),

    dependencies: [
        signalBuses,
    ],
}

// --------------------------------- node implementation - send~ ---------------------------------- //
const variableNamesSend = generateVariableNamesNodeType('send_t', [
    'setBusName'
])

const nodeImplementationSend: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesSend),

    flags: {
        alphaName: 'send_t',
    },

    dsp: ({ state, ins }) => ast`
        setSignalBus(${state}.busName, ${ins.$0})
    `,

    core: ({ stateClassName }) => 
        sharedCore(variableNamesSend, stateClassName),

    dependencies: [
        signalBuses,
    ],
}

// --------------------------------- node implementation - receive~ ---------------------------------- //
const variableNamesReceive = generateVariableNamesNodeType('receive_t', [
    'setBusName'
])

const nodeImplementationReceive: _NodeImplementation = {
    ...sharedNodeImplementation(variableNamesReceive),

    flags: {
        alphaName: 'receive_t',
        isDspInline: true,
    },

    dsp: ({ state }) => 
        ast`readSignalBus(${state}.busName)`,
    
    messageReceivers: ({ state }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNamesReceive.setBusName}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),

    core: ({ stateClassName }) => 
        sharedCore(variableNamesReceive, stateClassName),

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

