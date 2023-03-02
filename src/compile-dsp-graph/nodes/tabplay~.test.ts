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
import { nodeImplementation, builder } from './tabplay~'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeTranslateArgs } from '../nodes-shared-code/test-helpers'

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
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should change array when sent set %s', async ({ target, bitDepth }) => {
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
        })

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

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should update array when new array set %s', async ({ target, bitDepth }) => {
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
                [{ ins: { '0': [['bang']] } }, { outs: { '0': 11, '1': [] } }],
                [{}, { outs: { '0': 22, '1': [['bang']] } }],
                [{}, { outs: { '0': 0, '1': [] } }]
            )
        })

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
    })
})
