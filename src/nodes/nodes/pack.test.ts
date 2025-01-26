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

import * as testHelpers from '@webpd/compiler/src/test-helpers'
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
                    typeArguments: [['float', 0], ['float', 0]],
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
                await testHelpers.assertNodeOutput(
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
                await testHelpers.assertNodeOutput(
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
                await testHelpers.assertNodeOutput(
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
                await testHelpers.assertNodeOutput(
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
