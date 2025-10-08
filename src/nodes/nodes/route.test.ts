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
import { nodeImplementation, builder } from './route'
import { PartialNode } from '../../compile-dsp-graph/types'

describe('route', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [123, 'bla'], {
                    filters: [123, 'bla'],
                })
                testNodeTranslateArgs(builder, [], {
                    filters: [0],
                })
            })
        })

        describe('build', () => {
            it('should render 1 inlet and outlets for each filter', () => {
                testNodeBuild(
                    builder,
                    { filters: [123, 'bla'] },
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

            it('should render 2 inlets and 2 outlets if no filter or filter length 1', () => {
                const expectedPartialNode: PartialNode = {
                    inlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                    },
                    outlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                    },
                }
                testNodeBuild(
                    builder,
                    { filters: ['bla'] },
                    expectedPartialNode
                )
                testNodeBuild(builder, { filters: [1] }, expectedPartialNode)
            })
        })
    })

    describe('implementation - several filters', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output to the appropriate outlet if matches filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: [123, 'bla'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[123, 'poi', 678]] } },
                        { outs: { '0': [['poi', 678]], '1': [], '2': [] } },
                    ],
                    [
                        { ins: { '0': [['bla', 999]] } },
                        { outs: { '0': [], '1': [[999]], '2': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if all tokens are filtered out %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: [123, 456],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[123]] } },
                        { outs: { '0': [['bang']], '1': [], '2': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output to last outlet if not matching %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: [123, 789],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, '999']] } },
                        { outs: { '0': [], '1': [], '2': [[666, '999']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output float if float filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: [789, 'float'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, '999']] } },
                        { outs: { '0': [], '1': [[666, '999']], '2': [] } },
                    ],
                    [
                        { ins: { '0': [[789, '999']] } },
                        { outs: { '0': [['999']], '1': [], '2': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output string if symbol filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['bla', 'symbol'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['hello', '999']] } },
                        { outs: { '0': [], '1': [['hello', '999']], '2': [] } },
                    ],
                    [
                        { ins: { '0': [['bla', '999']] } },
                        { outs: { '0': [['999']], '1': [], '2': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if bang filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['bang', 'symbol'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']], '1': [], '2': [] } },
                    ],
                    [
                        { ins: { '0': [['bla', '999']] } },
                        { outs: { '0': [], '1': [['bla', '999']], '2': [] } },
                    ]
                )
            }
        )
    })

    describe('implementation - single filter', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change the filter with inlet 1 if single filter arguments  %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['bla'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bla']] } },
                        { outs: { '0': [['bang']], '1': [] } },
                    ],
                    [
                        { ins: { '1': [['blo']] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [
                        { ins: { '0': [['blo']] } },
                        { outs: { '0': [['bang']], '1': [] } },
                    ],
                    [
                        { ins: { '0': [['hello']] } },
                        { outs: { '0': [], '1': [['hello']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output float if float filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['float'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, '999']] } },
                        { outs: { '0': [[666, '999']], '1': [] } },
                    ],
                    [
                        { ins: { '0': [['999']] } },
                        { outs: { '0': [], '1': [['999']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output string if symbol filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['symbol'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['hello', '999']] } },
                        { outs: { '0': [['hello', '999']], '1': [] } },
                    ],
                    [
                        { ins: { '0': [[987, '999']] } },
                        { outs: { '0': [], '1': [[987, '999']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if bang filter %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'route', {
                            filters: ['bang'],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']], '1': [] } },
                    ],
                    [
                        { ins: { '0': [['bla', '999']] } },
                        { outs: { '0': [], '1': [['bla', '999']] } },
                    ]
                )
            }
        )
    })
})
