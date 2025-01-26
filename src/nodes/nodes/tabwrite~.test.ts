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

import * as testHelpers from '@webpd/compiler/src/test-helpers'
import { nodeImplementation, builder } from './tabwrite~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('tabwrite~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    arrayName: '',
                })

                testNodeTranslateArgs(builder, ['bla'], {
                    arrayName: 'bla',
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change array when sent set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite~', {
                            arrayName: 'UNKNOWN_ARRAY',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3, 4, 5],
                        },
                    },
                    [{ ins: { '0': 11 } }, { outs: {} }],
                    [{ ins: { '0': 22 } }, { outs: {} }],
                    [
                        {
                            ins: {
                                '0': 33,
                                '0_message': [['set', 'myArray'], ['bang']],
                            },
                        },
                        { outs: {} },
                    ],
                    [
                        {
                            ins: { '0': 44 },
                            commons: { getArray: ['myArray'] },
                        },
                        {
                            outs: {},
                            commons: {
                                getArray: { myArray: [33, 2, 3, 4, 5] },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should write from beginning to end when receiving bang %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '0': 11 } }, { outs: {} }],
                    [
                        { ins: { '0': 22, '0_message': [['bang']] } },
                        { outs: {} },
                    ],
                    [{ ins: { '0': 33 } }, { outs: {} }],
                    [{ ins: { '0': 44 } }, { outs: {} }],
                    [
                        {
                            ins: { '0': 55 },
                            commons: { getArray: ['myArray'] },
                        },
                        {
                            outs: {},
                            commons: {
                                getArray: { myArray: [22, 33, 44] },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop writing when receiving stop %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3, 4, 5, 6],
                        },
                    },
                    [{ ins: { '0': 11 } }, { outs: {} }],
                    [
                        { ins: { '0': 22, '0_message': [['bang']] } },
                        { outs: {} },
                    ],
                    [{ ins: { '0': 33 } }, { outs: {} }],
                    [
                        {
                            ins: { '0': 44, '0_message': [['stop']] },
                        },
                        {
                            outs: {},
                        },
                    ],
                    [
                        {
                            ins: { '0': 55 },
                            commons: { getArray: ['myArray'] },
                        },
                        {
                            outs: {},
                            commons: {
                                getArray: { myArray: [22, 33, 3, 4, 5, 6] },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should write from given position when receiving start %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3, 4, 5],
                        },
                    },
                    [{ ins: { '0': 11 } }, { outs: {} }],
                    [
                        { ins: { '0': 22, '0_message': [['start', 3]] } },
                        { outs: {} },
                    ],
                    [{ ins: { '0': 33 } }, { outs: {} }],
                    [{ ins: { '0': 44 } }, { outs: {} }],
                    [
                        {
                            ins: { '0': 55 },
                            commons: { getArray: ['myArray'] },
                        },
                        {
                            outs: {},
                            commons: {
                                getArray: { myArray: [1, 2, 3, 22, 33] },
                            },
                        },
                    ]
                )
            }
        )
    })
})
