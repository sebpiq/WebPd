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
import { nodeImplementation, builder } from './tabread'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'

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
                await nodeImplementationsTestHelpers.assertNodeOutput(
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
                await nodeImplementationsTestHelpers.assertNodeOutput(
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
                await nodeImplementationsTestHelpers.assertNodeOutput(
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
                await nodeImplementationsTestHelpers.assertNodeOutput(
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
