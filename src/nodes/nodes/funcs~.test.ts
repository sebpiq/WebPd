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
import { nodeImplementations, builders } from './funcs~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../test-helpers'

describe('func~', () => {
    describe('implementation abs~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['abs~'], 'abs~', {
                            channelCount: 3,
                        }),
                        nodeImplementation: nodeImplementations['abs~'],
                    },
                    [{ ins: { '0': 10 } }, { outs: { '0': 10 } }],
                    [{ ins: { '0': -20 } }, { outs: { '0': 20 } }]
                )
            }
        )
    })
    describe('implementation cos~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['cos~'], 'cos~', {
                            channelCount: 3,
                        }),
                        nodeImplementation: nodeImplementations['cos~'],
                    },
                    [{ ins: { '0': -1 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 0 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 1 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 2 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 0.5 } }, { outs: { '0': -1 } }],
                    [{ ins: { '0': 0.25 } }, { outs: { '0': 0 } }]
                )
            }
        )
    })

    describe('implementation sqrt~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['sqrt~'], 'sqrt~', {}),
                        nodeImplementation: nodeImplementations['sqrt~'],
                    },
                    [
                        { ins: { '0': 9 } },
                        { outs: { '0': 3 } },
                    ],
                    [
                        { ins: { '0': -0.9 } },
                        { outs: { '0': 0 } },
                    ],
                    [
                        { ins: { '0': 0 } },
                        { outs: { '0': 0 } },
                    ],
                    [
                        { ins: { '0': 4 } },
                        { outs: { '0': 2 } },
                    ]
                )
            }
        )
    })

    describe('implementation wrap~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['wrap~'], 'wrap~', {}),
                        nodeImplementation: nodeImplementations['wrap~'],
                    },
                    [
                        { ins: { '0': 2.9 } },
                        { outs: { '0': 0.9 } },
                    ],
                    [
                        { ins: { '0': -0.9 } },
                        { outs: { '0': 0.1 } },
                    ],
                    [
                        { ins: { '0': -1 } },
                        { outs: { '0': 0 } },
                    ],
                    [
                        { ins: { '0': 10 } },
                        { outs: { '0': 0 } },
                    ]
                )
            }
        )
    })

    describe('implementation mtof~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['mtof~'], 'mtof~', {}),
                        nodeImplementation: nodeImplementations['mtof~'],
                    },
                    [
                        { ins: { '0': 69 } },
                        { outs: { '0': 440 } },
                    ],
                )
            }
        )
    })

    describe('implementation ftom~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['ftom~'], 'ftom~', {}),
                        nodeImplementation: nodeImplementations['ftom~'],
                    },
                    [
                        { ins: { '0': 440 } },
                        { outs: { '0': 69 } },
                    ],
                )
            }
        )
    })

    describe('implementation exp~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['exp~'], 'exp~', {}),
                        nodeImplementation: nodeImplementations['exp~'],
                    },
                    [
                        { ins: { '0': 0 } },
                        { outs: { '0': 1 } },
                    ],
                    [
                        { ins: { '0': 1 } },
                        { outs: { '0': Math.E } },
                    ],
                )
            }
        )
    })
})
