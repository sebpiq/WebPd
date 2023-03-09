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
import { assertOptionalNumber, assertOptionalString } from '../validation'
import { bangUtils } from '../nodes-shared-code/core'
import { coldFloatInletWithSetter } from '../standard-message-receivers'
import { computeUnitInSamples } from '../nodes-shared-code/timing'

interface NodeArguments { 
    delay: number,
    unitAmount: number,
    unit: string,
}
const stateVariables = {
    funcSetDelay: 1,
    funcScheduleDelay: 1,
    funcStopDelay: 1,
    delay: 1,
    scheduledBang: 1,
    sampleRatio: 1,
}
type _NodeImplementation = NodeImplementation<NodeArguments, typeof stateVariables>

// TODO : alias [del]
// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        delay: assertOptionalNumber(pdNode.args[0]) || 0,
        unitAmount: assertOptionalNumber(pdNode.args[1]) || 1,
        unit: assertOptionalString(pdNode.args[2]) || 'msec',
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

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({ 
    state, 
    globs, 
    node: { args }, 
    macros: { Func, Var } 
}) => 
    `
        let ${Var(state.delay, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.scheduledBang, 'Int')} = -1

        const ${state.funcSetDelay} = ${Func([
            Var('delay', 'Float')
        ], 'void')} => {
            ${state.delay} = Math.max(0, delay)
        }

        const ${state.funcScheduleDelay} = ${Func([], 'void')} => {
            ${state.scheduledBang} = toInt(Math.round(
                toFloat(${globs.frame}) + ${state.delay} * ${state.sampleRatio}))
        }

        const ${state.funcStopDelay} = ${Func([], 'void')} => {
            ${state.scheduledBang} = -1
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetDelay}(${args.delay})
        })
    `

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({state, snds, globs}) => `
    if (
        ${state.scheduledBang} > -1 
        && ${state.scheduledBang} <= ${globs.frame}
    ) {
        ${snds.$0}(msg_bang())
        ${state.scheduledBang} = -1
    }
`

// ------------------------------ messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({node, state, globs, macros: { Var }}) => ({
    '0': `
        if (msg_getLength(${globs.m}) === 1) {
            if (msg_isStringToken(${globs.m}, 0)) {
                const ${Var('action', 'string')} = msg_readStringToken(${globs.m}, 0)
                if (action === 'bang' || action === 'start') {
                    ${state.funcScheduleDelay}()
                    return
                } else if (action === 'stop') {
                    ${state.funcStopDelay}()
                    return
                }
                
            } else if (msg_isFloatToken(${globs.m}, 0)) {
                ${state.funcSetDelay}(msg_readFloatToken(${globs.m}, 0))
                ${state.funcScheduleDelay}()
                return 
            }
        
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
    
    '1': coldFloatInletWithSetter(globs.m, state.funcSetDelay)
})

// ------------------------------------------------------------------- //
const nodeImplementation: _NodeImplementation = {
    declare, 
    messages, 
    loop, 
    stateVariables, 
    sharedCode: [ computeUnitInSamples, bangUtils ]
}

export { 
    builder,
    nodeImplementation,
    NodeArguments,
}