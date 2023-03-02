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
import { nodeImplementation, builder } from './tabwrite'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'

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
