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

import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'
import { Func, Sequence, Var, ConstVar, VariableNamesIndex } from '@webpd/compiler'
import { _NodeImplementation } from './controls-float'
import { VariableName } from '@webpd/compiler/src/ast/types'

export interface NodeArguments {
    arrayName: string
}

export const translateArgsTabBase: NodeBuilder<NodeArguments>['translateArgs'] =
    (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    })

export const nodeCoreTabBase = (
    ns: { [name: string]: VariableName }, 
    { sked, commons }: VariableNamesIndex['globals']
) => 
    Sequence([
        ConstVar(`FloatArray`, ns.emptyArray, `createFloatArray(1)`),

        Func(ns.createState, [
            Var(`string`, `arrayName`),
        ], ns.State)`
            return {
                array: ${ns.emptyArray},
                arrayName,
                arrayChangesSubscription: ${sked.ID_NULL},
                readPosition: 0,
                readUntil: 0,
                writePosition: 0,
            }
        `,

        Func(ns.setArrayName, [
            Var(ns.State, `state`),
            Var(`string`, `arrayName`),
            Var(sked.Callback, `callback`),
        ], 'void')`
            if (state.arrayChangesSubscription != ${sked.ID_NULL}) {
                ${commons.cancelArrayChangesSubscription}(state.arrayChangesSubscription)
            }
            state.arrayName = arrayName
            state.array = ${ns.emptyArray}
            ${commons.subscribeArrayChanges}(arrayName, callback)
        `,

        Func(ns.prepareIndex, [
            Var(`Float`, `index`),
            Var(`Int`, `arrayLength`),
        ], 'Int')`
            return toInt(Math.min(
                Math.max(
                    0, Math.floor(index)
                ), toFloat(arrayLength - 1)
            ))
        `
    ])