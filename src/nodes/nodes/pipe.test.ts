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
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './pipe'

const SAMPLE_RATIO =
    1000 / nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS.sampleRate

describe('pipe', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    typeArguments: [['float', 0]],
                    delay: 0,
                })
                testNodeTranslateArgs(builder, [1000], {
                    typeArguments: [['float', 0]],
                    delay: 1000,
                })
                testNodeTranslateArgs(builder, [10, 'f', 's', 1000], {
                    typeArguments: [
                        ['float', 10],
                        ['float', 0],
                        ['symbol', 'symbol'],
                    ],
                    delay: 1000,
                })
            })
        })

        describe('build', () => {
            it('should have right number of inlets / outlets', () => {
                testNodeBuild(
                    builder,
                    { typeArguments: [['float', 0], ['symbol', 'bang']], delay: 0 },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                            '2': { type: 'message', id: '2' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                        },
                    }
                )
                testNodeBuild(
                    builder,
                    { typeArguments: [['float', 0]], delay: 0 },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should delay messages of specified time %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [['float', 0]],
                            delay: 3 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[-13], [456]] } }, { outs: { '0': [] } }],
                    [{ ins: { '0': [[890]] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [[-13], [456]] } }],
                    [{}, { outs: { '0': [[890]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should changed delay when sending on last inlet %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [['float', 0]],
                            delay: 10 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[1 * SAMPLE_RATIO]] } },
                        { outs: { '0': [] } },
                    ],
                    [{ ins: { '0': [[-12.12]] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [[-12.12]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should not change delay / content of already scheduled messages %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [
                                ['float', 0],
                                ['symbol', 'hello'],
                            ],
                            delay: 4 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[33]] } }, { outs: { '0': [], '1': [] } }],
                    [
                        { ins: { '1': [['poi']], '2': [[1 * SAMPLE_RATIO]] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    // This message should be output before the first scheduled message because
                    // delay was changed in between
                    [{ ins: { '0': [[44]] } }, { outs: { '0': [], '1': [] } }],
                    [{}, { outs: { '0': [[44]], '1': [['poi']] } }],
                    [{}, { outs: { '0': [[33]], '1': [['hello']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output all messages immediately on flush %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [
                                ['float', 0],
                                ['symbol', 'bla'],
                            ],
                            delay: 10 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[33], [-567]] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [
                        { ins: { '0': [[-999.123]] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [
                        { ins: { '0': [['flush']] } },
                        {
                            outs: {
                                '0': [[33], [-567], [-999.123]],
                                '1': [['bla'], ['bla'], ['bla']],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should clear messages %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [['float', 0]],
                            delay: 2 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[33], [-567]] } },
                        { outs: { '0': [] } },
                    ],
                    [{ ins: { '0': [['clear']] } }, { outs: { '0': [] } }],
                    [
                        {},
                        {
                            outs: {
                                '0': [],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should schedule last message again on bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [
                                ['symbol', 'bla'],
                                ['float', 199],
                            ],
                            delay: 1 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [{}, { outs: { '0': [['bla']], '1': [[199]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should schedule a single message sent as a list %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pipe', {
                            typeArguments: [
                                ['symbol', 'bla'],
                                ['float', 199],
                                ['symbol', 'hoho'],
                            ],
                            delay: 1 * SAMPLE_RATIO,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bli', 789, 'blu']] } },
                        { outs: { '0': [], '1': [], '2': [] } },
                    ],
                    [
                        {},
                        {
                            outs: {
                                '0': [['bli']],
                                '1': [[789]],
                                '2': [['blu']],
                            },
                        },
                    ]
                )
            }
        )
    })
})
