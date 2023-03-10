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

import { Code, NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalString } from '../validation'

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

export const declareTabBase: NodeImplementationTabBase['declare'] = (
    {state, node, macros: { Func, Var }},
) => `
    let ${Var(state.array, 'FloatArray')} = createFloatArray(0)
    let ${Var(state.arrayName, 'string')} = "${node.args.arrayName}"
    let ${Var(state.arrayChangesSubscription, 'SkedId')} = SKED_ID_NULL

    function ${state.funcSetArrayName} ${Func([
        Var('arrayName', 'string')
    ], 'void')} {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
        })
    }

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`

export const prepareIndexCode = (
    value: Code,
    { state }: Parameters<NodeImplementationTabBase['declare']>[0]
): Code =>
    `toInt(Math.min(
        Math.max(
            0, Math.floor(${value})
        ), toFloat(${state.array}.length - 1)
    ))`

export const messageSetArrayCode = ({
    globs,
    state,
}: Parameters<NodeImplementationTabBase['messages']>[0]): Code =>
    `else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))
        return

    }`