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

import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { nodeImplementation, builder } from './tabwrite'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('tabwrite', () => {
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
            'should write value at given index %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '1': [[1]] } }, { outs: {} }],
                    [{ ins: { '0': [[22]] } }, { outs: {} }],
                    [
                        { commons: { getArray: ['myArray'] } },
                        {
                            outs: {},
                            commons: { getArray: { myArray: [1, 22, 3] } },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should round index and limit between 0 and array length %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '1': [[-1]] } }, { outs: {} }],
                    [{ ins: { '0': [[111]] } }, { outs: {} }],
                    [{ ins: { '1': [[33]] } }, { outs: {} }],
                    [{ ins: { '0': [[3333]] } }, { outs: {} }],
                    [{ ins: { '1': [[1.9]] } }, { outs: {} }],
                    [{ ins: { '0': [[22222]] } }, { outs: {} }],
                    [
                        { commons: { getArray: ['myArray'] } },
                        {
                            outs: {},
                            commons: { getArray: { myArray: [111, 22222, 3333] } },
                        },
                    ]
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
                        node: buildNode(builder, 'tabwrite', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation,
                        arrays: { myArray: [] },
                    },
                    [
                        { commons: { setArray: { myArray: [11, 22] } } },
                        { outs: {}},
                    ],
                    [{ ins: { '1': [[0]] } }, { outs: {} }],
                    [{ ins: { '0': [[111]] } }, { outs: {} }],
                    [
                        { commons: { getArray: ['myArray'] } },
                        {
                            outs: {},
                            commons: { getArray: { myArray: [111, 22] } },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change array when sent set %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'tabwrite', {
                            arrayName: 'UNKNOWN_ARRAY',
                        }),
                        nodeImplementation,
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [
                        { ins: { '0': [['set', 'myArray']] } },
                        { outs: {}},
                    ],
                    [{ ins: { '1': [[0]] } }, { outs: {} }],
                    [{ ins: { '0': [[111]] } }, { outs: {} }],
                    [
                        { commons: { getArray: ['myArray'] } },
                        {
                            outs: {},
                            commons: { getArray: { myArray: [111, 2, 3] } },
                        },
                    ]
                )
            }
        )
    })
})
