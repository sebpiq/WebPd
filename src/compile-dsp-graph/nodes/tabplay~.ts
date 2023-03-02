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

import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../types'
import { assertOptionalString } from '../nodes-shared-code/validation'
import { bangUtils } from '../nodes-shared-code/core'

interface NodeArguments { arrayName: string }
const stateVariables = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    readPosition: 1,
    readUntil: 1,
    funcSetArrayName: 1,
    funcPlay: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : Should work also if array was set the play started
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
        },
    }),
}

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = (
    {state, node, macros: { Func, Var }},
) => `
    let ${Var(state.array, 'FloatArray')} = createFloatArray(0)
    let ${Var(state.arrayName, 'string')} = "${node.args.arrayName}"
    let ${Var(state.arrayChangesSubscription, 'SkedId')} = SKED_ID_NULL
    let ${Var(state.readPosition, 'Int')} = 0
    let ${Var(state.readUntil, 'Int')} = 0

    const ${state.funcSetArrayName} = ${Func([
        Var('arrayName', 'string')
    ], 'void')} => {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        ${state.readPosition} = 0
        ${state.readUntil} = 0        
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
            ${state.readPosition} = ${state.array}.length
            ${state.readUntil} = ${state.array}.length
        })
    }

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = (
    {state, snds, outs},
) => `
    if (${state.readPosition} < ${state.readUntil}) {
        ${outs.$0} = ${state.array}[${state.readPosition}]
        ${state.readPosition}++
        if (${state.readPosition} >= ${state.readUntil}) {
            ${snds.$1}(msg_bang())
        }
    } else {
        ${outs.$0} = 0
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ state, globs }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.readPosition} = 0
        ${state.readUntil} = ${state.array}.length
        return 
        
    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))   
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.readPosition} = toInt(msg_readFloatToken(${globs.m}, 0))
        ${state.readUntil} = ${state.array}.length
        return 

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
        ${state.readPosition} = toInt(msg_readFloatToken(${globs.m}, 0))
        ${state.readUntil} = toInt(Math.min(
            toFloat(${state.readPosition}) + msg_readFloatToken(${globs.m}, 1), 
            toFloat(${state.array}.length)
        ))
        return
    }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare,
    messages,
    loop,
    stateVariables,
    sharedCode: [ bangUtils ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}