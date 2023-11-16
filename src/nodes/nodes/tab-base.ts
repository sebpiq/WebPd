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
import { assertOptionalString } from '../validation'
import { Func, Var, ast } from '@webpd/compiler'
import { Code } from '@webpd/compiler'

interface NodeArgumentsTabBase {
    arrayName: string
}
export const stateVariablesTabBase = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    funcSetArrayName: 1,
}
type NodeImplementationTabBase = NodeImplementation<
    NodeArgumentsTabBase,
    typeof stateVariablesTabBase
>

export const translateArgsTabBase: NodeBuilder<NodeArgumentsTabBase>['translateArgs'] =
    (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    })

export const declareTabBase: NodeImplementationTabBase['generateDeclarations'] = (
    { state, node },
) => ast`
    ${Var('FloatArray', state.array, 'createFloatArray(0)')}
    ${Var('string', state.arrayName, `"${node.args.arrayName}"`)}
    ${Var('SkedId', state.arrayChangesSubscription, 'SKED_ID_NULL')}

    ${Func(state.funcSetArrayName, [
        Var('string', 'arrayName')
    ], 'void')`
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
        })
    `}

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`

export const prepareIndexCode = (
    value: Code,
    { state }: Parameters<NodeImplementationTabBase['generateDeclarations']>[0]
): Code =>
    `toInt(Math.min(
        Math.max(
            0, Math.floor(${value})
        ), toFloat(${state.array}.length - 1)
    ))`

export const messageSetArrayCode = ({
    state,
}: Parameters<NodeImplementationTabBase['generateMessageReceivers']>[0]): Code =>
    `else if (
        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(m, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(m, 1))
        return

    }`