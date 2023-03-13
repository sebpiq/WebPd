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

import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
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