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
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { declareTabBase, messageSetArrayCode, prepareIndexCode, stateVariablesTabBase, translateArgsTabBase } from './tab-base'

interface NodeArguments { arrayName: string }
const stateVariables = stateVariablesTabBase
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
}

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = declareTabBase

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = (context) => {
    const { snds, state, globs } = context
    return {
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {        
            if (${state.array}.length === 0) {
                ${snds.$0}(msg_floats([0]))

            } else {
                ${snds.$0}(msg_floats([${state.array}[${prepareIndexCode(`msg_readFloatToken(${globs.m}, 0)`, context)}]]))
            }
            return 

        } ${messageSetArrayCode(context)}
        `,
    }
}

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare,
    messages,
    stateVariables,
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}