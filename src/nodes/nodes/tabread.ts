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
import { declareTabBase, messageSetArrayCode, prepareIndexCode, stateVariablesTabBase, translateArgsTabBase } from './tab-base'
import { stdlib } from '@webpd/compiler'
import { AnonFunc, Var } from '@webpd/compiler/src/ast/declare'

interface NodeArguments { arrayName: string }
const stateVariables = stateVariablesTabBase
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = declareTabBase

// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers: _NodeImplementation['generateMessageReceivers'] = (context) => {
    const { snds, state } = context
    return {
        '0': AnonFunc([Var('Message', 'm')], 'void')`
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                if (${state.array}.length === 0) {
                    ${snds.$0}(msg_floats([0]))

                } else {
                    ${snds.$0}(msg_floats([${state.array}[${prepareIndexCode(`msg_readFloatToken(m, 0)`, context)}]]))
                }
                return 

            } ${messageSetArrayCode(context)}
        `,
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    generateDeclarations,
    generateMessageReceivers,
    stateVariables,
    dependencies: [stdlib.commonsWaitEngineConfigure, stdlib.commonsArrays]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}