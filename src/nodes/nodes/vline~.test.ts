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
import { nodeImplementation, builder } from './vline~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../test-helpers'

const SAMPLE_RATE = 10000
const SAMP_RATIO =
    1000 / SAMPLE_RATE

describe('vline~', () => {
    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should schedule several line with 1, 2 or 3 floats %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        sampleRate: SAMPLE_RATE,
                        node: buildNode(builder, 'vline~', {}),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [2],
                                    [3, 2.5 * SAMP_RATIO], // 0.4 slope
                                    [5, 4 * SAMP_RATIO, 2 * SAMP_RATIO], // 0.55 slope
                                ],
                            },
                        },
                        { outs: { '0': 2 } },
                    ],
                    [{}, { outs: { '0': 2 + 1 * 0.4 } }],
                    [{}, { outs: { '0': 2 + 2 * 0.4 } }],
                    [{}, { outs: { '0': 2.8 + 1 * 0.55 } }],
                    [{}, { outs: { '0': 2.8 + 2 * 0.55 } }],
                    [{}, { outs: { '0': 2.8 + 3 * 0.55 } }],
                    [{}, { outs: { '0': 5 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should schedule an instant change and ramp at later time %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        sampleRate: 10000,
                        node: buildNode(builder, 'vline~', {}),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [3, 0, 1 * SAMP_RATIO],
                                    [4, 2 * SAMP_RATIO, 1 * SAMP_RATIO],
                                ],
                            },
                        },
                        { outs: { '0': 0 } },
                    ],
                    [{}, { outs: { '0': 3 } }],
                    [{}, { outs: { '0': 3.5 } }],
                    [{}, { outs: { '0': 4 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should handle message inputs %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        sampleRate: SAMPLE_RATE,
                        node: buildNode(builder, 'vline~', {}),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '1': [[2 * SAMP_RATIO]],
                                '2': [[1 * SAMP_RATIO]],
                            },
                        },
                        { outs: { '0': 0 } },
                    ],
                    [{ ins: { '0': [[4]] } }, { outs: { '0': 0 } }],
                    [{}, { outs: { '0': 0 } }],
                    [{}, { outs: { '0': 2 } }],
                    [{}, { outs: { '0': 4 } }],

                    // inlets 1 & 2 don't have memory
                    [{ ins: { '0': [[10]] } }, { outs: { '0': 10 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should be handle instant change and line at the same frame %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        sampleRate: SAMPLE_RATE,
                        node: buildNode(builder, 'vline~', {}),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [[4, 0], [0, 4 * SAMP_RATIO]]
                            },
                        },
                        { outs: { '0': 4 } },
                    ],
                    [{}, { outs: { '0': 3 } }],
                    [{}, { outs: { '0': 2 } }],
                    [{}, { outs: { '0': 1 } }],
                    [{}, { outs: { '0': 0 } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop the line on "stop" %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        sampleRate: SAMPLE_RATE,
                        node: buildNode(builder, 'vline~', {}),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [3, 0, 1 * SAMP_RATIO],
                                    [4, 2 * SAMP_RATIO, 1 * SAMP_RATIO],
                                ],
                            },
                        },
                        { outs: { '0': 0 } },
                    ],
                    [{}, { outs: { '0': 3 } }],
                    [{ ins: {} }, { outs: { '0': 3.5 } }],
                    [{ ins: { '0': [['stop']] } }, { outs: { '0': 3.5 } }]
                )
            }
        )
    })
})
