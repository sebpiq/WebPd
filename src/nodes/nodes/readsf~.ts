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

import { functional } from '@webpd/compiler-js'
import { NodeImplementation } from '@webpd/compiler-js/src/types'
import { NodeBuilder } from '../../compile-dsp-graph/types'
import { assertOptionalNumber } from '../validation'
import { bangUtils, stringMsgUtils } from '../nodes-shared-code/core'
import { parseReadWriteFsOpts, parseSoundFileOpenOpts } from '../nodes-shared-code/fs'

interface NodeArguments {
    channelCount: number
}
const stateVariables = {
    buffers: 1,
    readingStatus: 1,
    streamOperationId: 1,
    frame: 1,
}
type _NodeImplementation = NodeImplementation<
    NodeArguments,
    typeof stateVariables
>

// TODO : check the real state machine of readsf
//      - what happens when start / stopping / start stream ?
//      - what happens when stream ended and starting again ?
//      - etc ...
// TODO : second arg : "buffer channel size" not implemented
// TODO : implement raw

// ------------------------------- node builder ------------------------------ //
const builder: NodeBuilder<NodeArguments> = {
    translateArgs: (pdNode) => ({
        channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
    }),
    build: (nodeArgs) => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            ...functional.mapArray(
                functional.countTo(nodeArgs.channelCount),
                (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]
            ),
            [`${nodeArgs.channelCount}`]: {
                type: 'message',
                id: `${nodeArgs.channelCount}`,
            }
        },
    })
}

// ------------------------------ declare ------------------------------ //
const declare: _NodeImplementation['declare'] = ({
    macros: { Var },
    state,
}) => `
    let ${Var(state.buffers, 'Array<buf_SoundBuffer>')} = []
    let ${Var(state.streamOperationId, 'fs_OperationId')} = -1
    let ${Var(state.readingStatus, 'Int')} = 0
`

// ------------------------------- loop ------------------------------ //
const loop: _NodeImplementation['loop'] = ({
    state,
    snds,
    outs,
    node: {
        args: { channelCount },
    },
}) => functional.renderCode`
    switch(${state.readingStatus}) {
        case 1: 
            ${functional.countTo(channelCount).map((i) => 
                `${outs[i]} = buf_pullSample(${state.buffers}[${i}])`)}
            break
            
        case 2: 
            ${functional.countTo(channelCount).map((i) => 
                `${outs[i]} = buf_pullSample(${state.buffers}[${i}])`)}
            if (${state.buffers}[0].pullAvailableLength === 0) {
                ${snds[channelCount]}(msg_bang())
                ${state.readingStatus} = 3
            }
            break

        case 3: 
            ${functional.countTo(channelCount).map((i) => `${outs[i]} = 0`)}
            ${state.readingStatus} = 0
            break
    }
`

// ------------------------------- messages ------------------------------ //
const messages: _NodeImplementation['messages'] = ({
    node,
    state,
    globs,
    macros: { Var },
}) => ({
    '0': `
    if (msg_getLength(${globs.m}) >= 2) {
        if (msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'open'
        ) {
            if (${state.streamOperationId} !== -1) {
                ${state.readingStatus} = 3
                fs_closeSoundStream(${
                    state.streamOperationId
                }, FS_OPERATION_SUCCESS)
            }

            const ${Var('soundInfo', 'fs_SoundInfo')} = {
                channelCount: ${node.args.channelCount},
                sampleRate: toInt(${globs.sampleRate}),
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }
            const ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
                ${globs.m},
                soundInfo,
            )
            const ${Var('url', 'string')} = parseReadWriteFsOpts(
                ${globs.m},
                soundInfo,
                unhandledOptions
            )
            if (url.length === 0) {
                return
            }
            ${state.streamOperationId} = fs_openSoundReadStream(
                url,
                soundInfo,
                () => {
                    ${state.streamOperationId} = -1
                    if (${state.readingStatus} === 1) {
                        ${state.readingStatus} = 2
                    } else {
                        ${state.readingStatus} = 3
                    }
                }
            )
            ${state.buffers} = _FS_SOUND_STREAM_BUFFERS.get(${state.streamOperationId})
            return
        }

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        if (msg_readFloatToken(${globs.m}, 0) === 0) {
            ${state.readingStatus} = 3
            return

        } else {
            if (${state.streamOperationId} !== -1) {
                ${state.readingStatus} = 1
            } else {
                console.log('[readsf~] start requested without prior open')
            }
            return

        }
        
    } else if (msg_isAction(${globs.m}, 'print')) {
        console.log('[readsf~] reading = ' + ${state.readingStatus}.toString())
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
    sharedCode: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        bangUtils,
        stringMsgUtils,
    ],
}

export { builder, nodeImplementation, NodeArguments }
