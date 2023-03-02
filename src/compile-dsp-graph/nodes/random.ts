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
import { assertOptionalNumber } from '../nodes-shared-code/validation'
import { bangUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../nodes-shared-code/standard-message-receivers'

interface NodeArguments {
    maxValue: number
}
const stateVariables = {
    maxValue: 1,
    funcSetMaxValue: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : make seed work
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: ({ args }) => ({
        maxValue: assertOptionalNumber(args[0]) || 0,
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
    node,
    state,
    macros: { Var, Func },
}) => `
    let ${Var(state.maxValue, 'Float')} = ${node.args.maxValue}

    function ${state.funcSetMaxValue} ${Func([
        Var('maxValue', 'Float')
    ], 'void')} {
        ${state.maxValue} = Math.max(maxValue, 0)
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({ snds, globs, state }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${snds['0']}(msg_floats([Math.floor(Math.random() * ${state.maxValue})]))
        return
    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'seed'
    ) {
        console.log('WARNING : seed not implemented yet for [random]')
        return
    }
    `,

    '1': coldFloatInletWithSetter(globs.m, state.funcSetMaxValue),
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    messages,
    stateVariables,
    declare,
    sharedCode: [bangUtils],
}

export { builder, nodeImplementation, NodeArguments }
