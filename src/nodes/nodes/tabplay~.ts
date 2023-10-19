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
import { assertOptionalString } from '../validation'
import { bangUtils, stringMsgUtils } from '../global-code/core'
import { coreCode } from '@webpd/compiler'

interface NodeArguments { arrayName: string }
const stateVariables = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    readPosition: 1,
    readUntil: 1,
    funcSetArrayName: 1,
    funcStop: 1,
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

    function ${state.funcSetArrayName} ${Func([
        Var('arrayName', 'string')
    ], 'void')} {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        ${state.funcStop}()
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
            ${state.readPosition} = ${state.array}.length
            ${state.readUntil} = ${state.array}.length
        })
    }

    function ${state.funcPlay} ${Func([
        Var('playFrom', 'Int'),
        Var('playTo', 'Int'),
    ], 'void')} {
        ${state.readPosition} = playFrom
        ${state.readUntil} = toInt(Math.min(
            toFloat(playTo), 
            toFloat(${state.array}.length),
        ))
    }

    function ${state.funcStop} ${Func([], 'void')} {
        ${state.readPosition} = 0
        ${state.readUntil} = 0
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
const messages: _NodeImplementation['messages'] = ({ state, globs, macros: { Var } }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.funcPlay}(0, ${state.array}.length)
        return 
        
    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStop}()
        return 

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))   
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.funcPlay}(
            toInt(msg_readFloatToken(${globs.m}, 0)), 
            ${state.array}.length
        )
        return 

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
        const ${Var('fromSample', 'Int')} = toInt(msg_readFloatToken(${globs.m}, 0))
        ${state.funcPlay}(
            fromSample,
            fromSample + toInt(msg_readFloatToken(${globs.m}, 1)),
        )
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
    globalCode: [
        bangUtils,
        coreCode.commonsWaitEngineConfigure,
        coreCode.commonsArrays,
        stringMsgUtils,
    ],
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}