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