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

import { NodeImplementation } from '@webpd/compiler/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils } from '../global-code/core'
import { computeUnitInSamples } from '../global-code/timing'
import { coreCode } from '@webpd/compiler'

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
    globalCode: [ computeUnitInSamples, bangUtils, coreCode.commonsWaitEngineConfigure ]
}

export { builder, nodeImplementation, NodeArguments }
