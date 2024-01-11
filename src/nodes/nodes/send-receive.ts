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

import { GlobalCodeGenerator, NodeImplementation } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { messageBuses } from '../global-code/buses'
import { coldStringInlet } from '../standard-message-receivers'
import { Class, ConstVar, Sequence, stdlib } from '@webpd/compiler'
import { AnonFunc, Var, ast } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'

interface NodeArguments {
    busName: string
}

type _NodeImplementation = NodeImplementation<NodeArguments>

// ------------------------------- node builder ------------------------------ //
const builderSend: NodeBuilder<NodeArguments> = {
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

const builderReceive: NodeBuilder<NodeArguments> = {
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

// -------------------------------- node implementation - send ----------------------------------- //
const variableNames = generateVariableNamesNodeType('send')

const nodeImplementationSend: _NodeImplementation = {
    stateInitialization: ({ node: { args } }) => 
        Var(variableNames.stateClass, '', `{
            busName: "${args.busName}",
        }`),
        
    messageReceivers: ({
        state,
    }) => ({
        '0': AnonFunc([Var('Message', 'm')])`
            msgBusPublish(${state}.busName, m)
            return
        `,
    
        '1': coldStringInlet(`${state}.busName`)
    }),

    dependencies: [
        messageBuses, 
        stdlib.commonsWaitEngineConfigure,
        () => Sequence([
            Class(variableNames.stateClass, [
                Var('string', 'busName')
            ]),
        ]),
    ],
}

// -------------------------------- node implementation - receive ----------------------------------- //
const nodeImplementationReceive: _NodeImplementation = {
    initialization: ({ node: { args }, snds }) => 
        ast`
            commons_waitEngineConfigure(() => {
                msgBusSubscribe("${args.busName}", ${snds.$0})
            })
        `,
    
    dependencies: [
        messageBuses, 
        stdlib.commonsWaitEngineConfigure,
    ],
}

// ------------------------------------------------------------------------ //
const builders = {
    send: builderSend,
    receive: builderReceive,
}

const nodeImplementations = {
    send: nodeImplementationSend,
    receive: nodeImplementationReceive,
}

export { builders, nodeImplementations, NodeArguments }
