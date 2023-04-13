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
import { nodeImplementation, builder } from './tabplay~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('tabplay~', () => {
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
            'should change array when sent set %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'UNKNOWN_ARRAY',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [
                        { ins: { '0': [['set', 'myArray'], ['bang']] } },
                        { outs: { '0': 1, '1': [] } },
                    ],
                    [{ ins: {} }, { outs: { '0': 2, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read from beginning to end when receiving bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [11, 22, 33],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': 11, '1': [] } },
                    ],
                    [{ ins: {} }, { outs: { '0': 22, '1': [] } }],
                    [{ ins: {} }, { outs: { '0': 33, '1': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop reading when receiving stop %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [11, 22, 33],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': 11, '1': [] } },
                    ],
                    [
                        { ins: { '0': [['stop']] } },
                        { outs: { '0': 0, '1': [] } },
                    ],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read from sample when receiving float %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [{ ins: { '0': [[3]] } }, { outs: { '0': 0.4, '1': [] } }],
                    [{ ins: {} }, { outs: { '0': 0.5, '1': [] } }],
                    [{ ins: {} }, { outs: { '0': 0.6, '1': [] } }],
                    [{ ins: {} }, { outs: { '0': 0.7, '1': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should update array when new array set %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {},
                    },
                    [{}, { outs: { '0': 0, '1': [] } }],
                    [
                        { commons: { setArray: { myArray: [11, 22] } } },
                        { outs: { '0': 0, '1': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': 11, '1': [] } },
                    ],
                    [{}, { outs: { '0': 22, '1': [['bang']] } }],
                    [{}, { outs: { '0': 0, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read from sample to sample when receiving 2 floats %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [
                        { ins: { '0': [[3, 2]] } },
                        { outs: { '0': 0.4, '1': [] } },
                    ],
                    [{ ins: {} }, { outs: { '0': 0.5, '1': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop at array length even if received bigger read end number %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabplay~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5],
                        },
                    },
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }],
                    [
                        { ins: { '0': [[3, 42]] } },
                        { outs: { '0': 0.4, '1': [] } },
                    ],
                    [{ ins: {} }, { outs: { '0': 0.5, '1': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': 0, '1': [] } }]
                )
            }
        )
    })
})
