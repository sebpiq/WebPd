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

import { FS_OPERATION_SUCCESS } from '@webpd/compiler-js'
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { nodeImplementation, builder } from './readsf~'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeBuild, testNodeTranslateArgs } from '../test-helpers'

describe('readsf~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builder, [], { channelCount: 1 })
                testNodeTranslateArgs(builder, [3], { channelCount: 3 })
            })
        })
        describe('build', () => {
            it('should build signal outlets according to channelCount', () => {
                testNodeBuild(
                    builder,
                    { channelCount: 1 },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'message', id: '1' },
                        },
                    }
                )
                testNodeBuild(
                    builder,
                    { channelCount: 3 },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
                            '2': { type: 'signal', id: '2' },
                            '3': { type: 'message', id: '3' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send out request to open read stream %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'readsf~', {
                            channelCount: 3,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['open', '/some/url']] } },
                        {
                            fs: {
                                onOpenSoundReadStream: [
                                    1,
                                    '/some/url',
                                    [3, 44100, 32, '', '', ''],
                                ],
                            },
                            outs: {
                                '0': 0,
                                '1': 0,
                                '2': 0,
                                '3': [],
                            },
                        },
                    ],
                    [
                        {
                            ins: { '0': [[1]] },
                            fs: {
                                sendSoundStreamData: [
                                    1,
                                    [
                                        new Float32Array([11, 12, 13]),
                                        new Float32Array([21, 22, 23]),
                                        new Float32Array([31, 32, 33]),
                                    ],
                                ],
                            },
                        },
                        { outs: { '0': 11, '1': 21, '2': 31, '3': [] } },
                    ],
                    [
                        {
                            fs: {
                                closeSoundStream: [1, FS_OPERATION_SUCCESS],
                            },
                        },
                        {
                            outs: { '0': 12, '1': 22, '2': 32, '3': [] },
                            fs: {
                                onCloseSoundStream: [1, FS_OPERATION_SUCCESS],
                            },
                        },
                    ],
                    [
                        { ins: {} },
                        { outs: { '0': 13, '1': 23, '2': 33, '3': [['bang']] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output signal 0 when reading done %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'readsf~', {
                            channelCount: 3,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['open', '/some/url']] } },
                        {
                            fs: {
                                onOpenSoundReadStream: [
                                    1,
                                    '/some/url',
                                    [3, 44100, 32, '', '', ''],
                                ],
                            },
                            outs: {
                                '0': 0,
                                '1': 0,
                                '2': 0,
                                '3': [],
                            },
                        },
                    ],
                    [
                        {
                            ins: { '0': [[1]] },
                            fs: {
                                sendSoundStreamData: [
                                    1,
                                    [
                                        new Float32Array([11, 12]),
                                        new Float32Array([21, 22]),
                                        new Float32Array([31, 32]),
                                    ],
                                ],
                            },
                        },
                        { outs: { '0': 11, '1': 21, '2': 31, '3': [] } },
                    ],
                    [
                        {
                            fs: {
                                closeSoundStream: [1, FS_OPERATION_SUCCESS],
                            },
                        },
                        {
                            outs: { '0': 12, '1': 22, '2': 32, '3': [['bang']] },
                            fs: {
                                onCloseSoundStream: [1, FS_OPERATION_SUCCESS],
                            },
                        },
                    ],
                    [
                        {},
                        {
                            outs: { '0': 0, '1': 0, '2': 0, '3': [] },
                        },
                    ],
                )
            }
        )

        it.each([NODE_IMPLEMENTATION_TEST_PARAMETERS[0]])(
            'should interrupt reading when new open request sent %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'readsf~', {
                            channelCount: 3,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['open', '/some/url']] } },
                        {
                            fs: {
                                onOpenSoundReadStream: [
                                    1,
                                    '/some/url',
                                    [3, 44100, 32, '', '', ''],
                                ],
                            },
                            outs: {
                                '0': 0,
                                '1': 0,
                                '2': 0,
                                '3': [],
                            },
                        },
                    ],
                    [
                        {
                            ins: { '0': [[1]] },
                            fs: {
                                sendSoundStreamData: [
                                    1,
                                    [
                                        new Float32Array([11, 12, 13]),
                                        new Float32Array([21, 22, 23]),
                                        new Float32Array([31, 32, 33]),
                                    ],
                                ],
                            },
                        },
                        { outs: { '0': 11, '1': 21, '2': 31, '3': [] } },
                    ],
                    [
                        { ins: { '0': [['open', '/other/url']] } },
                        {
                            // Opens operation 2 and closes operation 1
                            fs: {
                                onOpenSoundReadStream: [
                                    2,
                                    '/other/url',
                                    [3, 44100, 32, '', '', ''],
                                ],
                                onCloseSoundStream: [
                                    1, FS_OPERATION_SUCCESS
                                ]
                            },
                            // Reading is interrupted
                            outs: {
                                '0': 0,
                                '1': 0,
                                '2': 0,
                                '3': [],
                            },
                        },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should print infos %s', async ({ target, bitDepth }) => {
            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'readsf~', {
                        channelCount: 1,
                    }),
                    nodeImplementation,
                },
                [
                    {
                        ins: {
                            '0': [['print']],
                        },
                    },
                    {
                        outs: { '0': 0, '1': [] },
                    },
                ]
            )
        })
    })
})
