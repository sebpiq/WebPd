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

import { GlobalCodeGenerator } from '@webpd/compiler/src/compile/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { Class, Func, Sequence, Var, ConstVar } from '@webpd/compiler'
import { generateVariableNamesNodeType } from '../variable-names'
import { _NodeImplementation } from './controls-float'

export interface NodeArguments {
    arrayName: string
}

export const translateArgsTabBase: NodeBuilder<NodeArguments>['translateArgs'] =
    (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    })

export const variableNamesTabBase = generateVariableNamesNodeType('tabbase', [
    'setArrayName',
    'createState',
    'prepareIndex',
    'emptyArray',
])

export const nodeCoreTabBase: GlobalCodeGenerator = () => Sequence([
    ConstVar('FloatArray', variableNamesTabBase.emptyArray, 'createFloatArray(1)'),

    Class(variableNamesTabBase.stateClass, [
        Var('FloatArray', 'array'),
        Var('string', 'arrayName'),
        Var('SkedId', 'arrayChangesSubscription'),
        Var('Int', 'readPosition'),
        Var('Int', 'readUntil'),
        Var('Int', 'writePosition')
    ]),

    Func(variableNamesTabBase.createState, [
        Var('string', 'arrayName'),
    ], variableNamesTabBase.stateClass)`
        return {
            array: ${variableNamesTabBase.emptyArray},
            arrayName,
            arrayChangesSubscription: SKED_ID_NULL,
            readPosition: 0,
            readUntil: 0,
            writePosition: 0,
        }
    `,

    Func(variableNamesTabBase.setArrayName, [
        Var(variableNamesTabBase.stateClass, 'state'),
        Var('string', 'arrayName'),
        Var('SkedCallback', 'callback'),
    ], 'void')`
        if (state.arrayChangesSubscription != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(state.arrayChangesSubscription)
        }
        state.arrayName = arrayName
        state.array = ${variableNamesTabBase.emptyArray}
        commons_subscribeArrayChanges(arrayName, callback)
    `,

    Func(variableNamesTabBase.prepareIndex, [
        Var('Float', 'index'),
        Var('Int', 'arrayLength'),
    ], 'Int')`
        return toInt(Math.min(
            Math.max(
                0, Math.floor(index)
            ), toFloat(arrayLength - 1)
        ))
    `
])