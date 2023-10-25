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
import { bangUtils } from '../global-code/core'
import { stdlib } from '@webpd/compiler'

interface NodeArguments {}
const stateVariables = {}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: { '0': { type: 'message', id: '0' } },
        isPushingMessages: true
    }),
}

// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations: _NodeImplementation['generateDeclarations'] = ({ snds }) => 
    `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = { 
    generateDeclarations, 
    stateVariables,
    dependencies: [ bangUtils, stdlib.commonsWaitFrame ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}