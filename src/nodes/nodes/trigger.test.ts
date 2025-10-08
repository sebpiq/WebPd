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

import { testHelpers } from '@webpd/compiler'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './trigger'

describe('trigger', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    typeArguments: ['bang', 'bang'],
                })
                testNodeTranslateArgs(builder, ['f', 'b', 's', 'l', 'a'], {
                    typeArguments: [
                        'float',
                        'bang',
                        'symbol',
                        'list',
                        'anything',
                    ],
                })
            })
        })

        describe('build', () => {
            it('should have right number of outlets', () => {
                testNodeBuild(
                    builder,
                    { typeArguments: ['bang', 'bang'] },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                        },
                    }
                )
                testNodeBuild(
                    builder,
                    { typeArguments: ['float', 'symbol', 'list'] },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                            '2': { type: 'message', id: '2' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send the expected values %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'trigger', {
                            typeArguments: [
                                'float',
                                'bang',
                                'symbol',
                                'list',
                                'anything',
                            ],
                        }),
                        nodeImplementation,
                    },
                    // In : float
                    [
                        { ins: { '0': [[123]] } },
                        {
                            outs: {
                                '0': [[123]],
                                '1': [['bang']],
                                '2': [['float']],
                                '3': [[123]],
                                '4': [[123]],
                            },
                            sequence: ['4', '3', '2', '1', '0'],
                        },
                    ],
                    // In : bang
                    [
                        { ins: { '0': [['bang']] } },
                        {
                            outs: {
                                '0': [[0]],
                                '1': [['bang']],
                                '2': [['symbol']],
                                '3': [['bang']],
                                '4': [['bang']],
                            },
                            sequence: ['4', '3', '2', '1', '0'],
                        },
                    ],
                    // In : string
                    [
                        { ins: { '0': [['bla']] } },
                        {
                            outs: {
                                '0': [[0]],
                                '1': [['bang']],
                                '2': [['bla']],
                                '3': [['bla']],
                                '4': [['bla']],
                            },
                            sequence: ['4', '3', '2', '1', '0'],
                        },
                    ],
                    // In list
                    [
                        { ins: { '0': [[123, 'bla']] } },
                        {
                            outs: {
                                '0': [[123]],
                                '1': [['bang']],
                                '2': [['float']],
                                '3': [[123, 'bla']],
                                '4': [[123, 'bla']],
                            },
                            sequence: ['4', '3', '2', '1', '0'],
                        },
                    ],
                    [
                        { ins: { '0': [['bla', 123]] } },
                        {
                            outs: {
                                '0': [[0]],
                                '1': [['bang']],
                                '2': [['bla']],
                                '3': [['bla', 123]],
                                '4': [['bla', 123]],
                            },
                            sequence: ['4', '3', '2', '1', '0'],
                        },
                    ]
                )
            }
        )
    })
})
