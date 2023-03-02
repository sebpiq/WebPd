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
import { assertOptionalNumber, assertOptionalString } from '../nodes-shared-code/validation'
import { bangUtils } from '../nodes-shared-code/core'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

interface NodeArguments {
    unitAmount: number
    unit: string
}
const stateVariables = {
    resetTime: 1,
    sampleRatio: 1
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        unitAmount: assertOptionalNumber(pdNode.args[0]) || 1,
        unit: assertOptionalString(pdNode.args[1]) || 'msec',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------- declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    state,
    globs,
    node: { args },
    macros: { Var },
}) => `
    let ${Var(state.sampleRatio, 'Float')} = 0
    let ${Var(state.resetTime, 'Int')} = 0

    commons_waitEngineConfigure(() => {
        ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
    })
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    snds,
    globs,
    state,
}) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.resetTime} = ${globs.frame}
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'tempo'
    ) {
        ${state.sampleRatio} = computeUnitInSamples(
            ${globs.sampleRate}, 
            msg_readFloatToken(${globs.m}, 1), 
            msg_readStringToken(${globs.m}, 2)
        )
        return
    }
    `,

    '1': `
    if (msg_isBang(${globs.m})) {
        ${snds.$0}(msg_floats([toFloat(${globs.frame} - ${state.resetTime}) / ${state.sampleRatio}]))
        return
    }
    `,
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    stateVariables,
    declare,
    messages,
    sharedCode: [ computeUnitInSamples, bangUtils ]
}

export { builder, nodeImplementation, NodeArguments }
