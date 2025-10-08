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

import { testHelpers } from '@webpd/compiler'
import { nodeImplementation, builder } from './tabread'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('tabread', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    arrayName: '',
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read value at given index %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabread', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '0': [[0]] } }, { outs: { '0': [[1]] } }],
                    [{ ins: { '0': [[2]] } }, { outs: { '0': [[3]] } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should round index and limit between 0 and array length %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabread', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '0': [[-1]] } }, { outs: { '0': [[1]] } }],
                    [{ ins: { '0': [[23]] } }, { outs: { '0': [[3]] } }],
                    [{ ins: { '0': [[1.9]] } }, { outs: { '0': [[2]] } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should update array when new array set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabread', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {},
                    },
                    [{ ins: {'0': [[0]]} }, { outs: { '0': [[0]] } }],
                    [
                        { commons: { setArray: { myArray: [11, 22] } } },
                        { outs: { '0': [] } },
                    ],
                    [{ ins: { '0': [[1]] } }, { outs: { '0': [[22]] } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change array when sent set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabread', {
                            arrayName: 'UNKNOWN_ARRAY',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: {'0': [[0]]} }, { outs: { '0': [[0]] } }],
                    [
                        { ins: { '0': [['set', 'myArray']] } },
                        { outs: { '0': [] } },
                    ],
                    [{ ins: {'0': [[1]]} }, { outs: { '0': [[2]] } }]
                )
            }
        )
    })
})
