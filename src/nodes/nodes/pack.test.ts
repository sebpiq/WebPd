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
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './pack'

describe('pack', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    typeArguments: [['float', 0]],
                })
                testNodeTranslateArgs(builder, [10, 'f', 's'], {
                    typeArguments: [
                        ['float', 10],
                        ['float', 0],
                        ['symbol', 'symbol'],
                    ],
                })
            })
        })

        describe('build', () => {
            it('should have right number of inlets / outlets', () => {
                testNodeBuild(
                    builder,
                    {
                        typeArguments: [
                            ['float', 0],
                            ['symbol', 'bang'],
                        ],
                    },
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
                testNodeBuild(
                    builder,
                    { typeArguments: [['float', 0]] },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
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
            'should output packed values %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pack', {
                            typeArguments: [
                                ['float', 123],
                                ['symbol', 'bla'],
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[11.11], [0]] } },
                        {
                            outs: {
                                '0': [
                                    [11.11, 'bla'],
                                    [0, 'bla'],
                                ],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should packed last value on bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pack', {
                            typeArguments: [
                                ['symbol', 'hello'],
                                ['float', -666.666],
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['hello', -666.666]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change values to pack when sending on cold inlets %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pack', {
                            typeArguments: [
                                ['symbol', 'hello'],
                                ['float', -666.666],
                                ['symbol', 'evil'],
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[999]], '2': [['live']] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['hello', 999, 'live']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change values to pack and output when sending in a list %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'pack', {
                            typeArguments: [
                                ['symbol', 'hello'],
                                ['float', -666.666],
                                ['symbol', 'evil'],
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['poi', 999]] } },
                        { outs: { '0': [['poi', 999, 'evil']] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['poi', 999, 'evil']] } },
                    ]
                )
            }
        )
    })
})
