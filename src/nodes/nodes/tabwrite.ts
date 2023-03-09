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
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { declareTabBase, messageSetArrayCode, prepareIndexCode, stateVariablesTabBase, translateArgsTabBase } from './tab-base'

interface NodeArguments { arrayName: string }
const stateVariables = {
    ...stateVariablesTabBase,
    index: 1,
    funcSetIndex: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
}

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = (context) => {
    const { state, macros: { Var, Func }} = context
    return `
        let ${Var(state.index, 'Int')} = 0
        ${declareTabBase(context)}

        function ${state.funcSetIndex} ${Func([
            Var('index', 'Float')
        ], 'void')} {
            ${state.index} = ${prepareIndexCode('index', context)}
        }
    `
}

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = (context) => {
    const { state, globs } = context
    return {
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {        
            if (${state.array}.length === 0) {
                return

            } else {
                ${state.array}[${state.index}] = msg_readFloatToken(${globs.m}, 0)
                return
            }
            return 

        } ${messageSetArrayCode(context)}
        `,

        '1': coldFloatInletWithSetter(globs.m, state.funcSetIndex)
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