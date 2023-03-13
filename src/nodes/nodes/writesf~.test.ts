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
import { nodeImplementation, builder } from './writesf~'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeBuild, testNodeTranslateArgs } from '../test-helpers'

describe('writesf~', () => {
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
                            '0_message': { type: 'message', id: '0_message' },
                            '0': { type: 'signal', id: '0' },
                        },
                        outlets: {},
                    }
                )
                testNodeBuild(
                    builder,
                    { channelCount: 3 },
                    {
                        inlets: {
                            '0_message': { type: 'message', id: '0_message' },
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
                            '2': { type: 'signal', id: '2' },
                        },
                        outlets: {},
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
                        node: buildNode(builder, 'writesf~', {
                            channelCount: 4,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: {} }, { outs: {} }],
                    [
                        {
                            ins: {
                                '0_message': [
                                    [
                                        'open',
                                        '/some/url',
                                        '-wave',
                                        '-bytes',
                                        3,
                                        '-rate',
                                        22050,
                                        '-big',
                                    ],
                                ],
                            },
                        },
                        {
                            outs: {},
                            fs: {
                                onOpenSoundWriteStream: [
                                    1,
                                    '/some/url',
                                    [4, 22050, 24, 'wave', 'b', ''],
                                ] as any,
                            },
                        },
                    ],
                    [{ ins: {} }, { outs: {} }],
                    [{ ins: {} }, { outs: {} }],
                    [{ ins: {} }, { outs: {} }],
                    [{ ins: {} }, { outs: {} }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should start / stop streaming on start / stop %s',
            async ({ target, bitDepth, floatArrayType }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'writesf~', {
                            channelCount: 2,
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0_message': [['open', '/some/url'], ['start']],
                                '0': 11,
                                '1': 21,
                            },
                        },
                        {
                            outs: {},
                            fs: {
                                onOpenSoundWriteStream: [
                                    1,
                                    '/some/url',
                                    [2, 44100, 32, '', '', ''],
                                ] as any,
                            },
                        },
                    ],
                    [{ ins: { '0': 12, '1': 22 } }, { outs: {} }],
                    [{ ins: { '0': 13, '1': 23 } }, { outs: {} }],
                    [{ ins: { '0': 14, '1': 24 } }, { outs: {} }],
                    [{ ins: { '0': 15, '1': 25 } }, { outs: {} }],
                    [
                        { ins: { '0_message': [['stop']] } },
                        {
                            outs: {},
                            fs: {
                                onSoundStreamData: [
                                    1,
                                    [
                                        new floatArrayType([11, 12, 13, 14, 15]),
                                        new floatArrayType([21, 22, 23, 24, 25]),
                                    ],
                                ] as any,
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should print infos %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'writesf~', {
                            channelCount: 2,
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0_message': [['print']],
                            },
                        },
                        {
                            outs: {},
                        },
                    ],
                )
            }
        )
    })
})
