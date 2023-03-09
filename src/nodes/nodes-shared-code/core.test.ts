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

import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { bangUtils, msgUtils } from './core'
import { NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'

describe('nodes-shared-code.core', () => {
    describe('msg_isBang', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should match given message %s',
            async ({ bitDepth, target }) => {
                await nodeImplementationsTestHelpers.assertSharedCodeFunctionOutput(
                    {
                        bitDepth,
                        target,
                        sharedCodeGenerators: [bangUtils],
                        functionName: 'msg_isBang',
                    },
                    { parameters: [['bang']], returns: true },
                    { parameters: [['bang', 123]], returns: true },
                    { parameters: [[1]], returns: false },
                    { parameters: [['bla', 'bla']], returns: false },
                )
            }
        )
    })

    describe('msg_bang', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should create bang message %s',
            async ({ bitDepth, target }) => {
                await nodeImplementationsTestHelpers.assertSharedCodeFunctionOutput(
                    {
                        bitDepth,
                        target,
                        sharedCodeGenerators: [bangUtils],
                        functionName: 'msg_bang',
                    },
                    { parameters: [], returns: ['bang'] },
                )
            }
        )
    })

    describe('msg_slice', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should slice the message as expected %s',
            async ({ bitDepth, target }) => {
                await nodeImplementationsTestHelpers.assertSharedCodeFunctionOutput(
                    {
                        bitDepth,
                        target,
                        sharedCodeGenerators: [msgUtils],
                        functionName: 'msg_slice',
                    },
                    { parameters: [['bla', 'blo', 1], 0, 3], returns: ['bla', 'blo', 1] },
                    { parameters: [['bla', 'blo', 1], 0, 2], returns: ['bla', 'blo'] },
                    { parameters: [['bla'], 0, 0], returns: [] },
                    { parameters: [[1, 2, 3], 1, 2], returns: [2] },
                )
            }
        )
    })

    describe('msg_concat', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should concatenate 2 messages %s',
            async ({ bitDepth, target }) => {
                await nodeImplementationsTestHelpers.assertSharedCodeFunctionOutput(
                    {
                        bitDepth,
                        target,
                        sharedCodeGenerators: [msgUtils],
                        functionName: 'msg_concat',
                    },
                    { parameters: [['bla', 'blo', 1], [666]], returns: ['bla', 'blo', 1, 666] },
                    { parameters: [['bla'], []], returns: ['bla'] },
                    { parameters: [[], [1, 2, 3]], returns: [1, 2, 3] },
                )
            }
        )
    })

    describe('msg_shift', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should concatenate 2 messages %s',
            async ({ bitDepth, target }) => {
                await nodeImplementationsTestHelpers.assertSharedCodeFunctionOutput(
                    {
                        bitDepth,
                        target,
                        sharedCodeGenerators: [msgUtils],
                        functionName: 'msg_shift',
                    },
                    { parameters: [['bla', 'blo', 1]], returns: ['blo', 1] },
                    { parameters: [['bla']], returns: [] },
                )
            }
        )
    })
})