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
import { builders, nodeImplementations } from './binop~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('binop~', () => {
    describe('builders', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builders['+~'], [], { value: 0 })
                testNodeTranslateArgs(builders['-~'], [], { value: 0 })
                testNodeTranslateArgs(builders['*~'], [], { value: 0 })
                testNodeTranslateArgs(builders['/~'], [], { value: 0 })
            })
        })
    })

    describe('implementation', () => {

        describe('+~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with signal as inlet 1 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['+~'], '+~', { value: 1 }),
                            nodeImplementation: nodeImplementations['+~'],
                        },
                        [
                            { ins: { '0': 1, '1': 0.1 } },
                            { outs: { '0': 1.1 } },
                        ],
                        [
                            { ins: { '0': 2, '1': 0.2 } },
                            { outs: { '0': 2.2 } },
                        ],
                        [
                            { ins: { '0': 3, '1': 0.3 } },
                            { outs: { '0': 3.3 } },
                        ]
                    )
                }
            )
        })

        describe('pow~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with signal as inlet 1 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['pow~'], 'pow~', { value: 0 }),
                            nodeImplementation: nodeImplementations['pow~'],
                        },
                        [
                            { ins: { '0': 2, '1': 4 } },
                            { outs: { '0': 16 } },
                        ],
                    )
                }
            )
        })

        describe('-~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with signal as inlet 1 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['-~'], '-~', { value: 1 }),
                            nodeImplementation: nodeImplementations['-~'],
                        },
                        [
                            { ins: { '0': 1, '1': 0.1 } },
                            { outs: { '0': 0.9 } },
                        ],
                        [
                            { ins: { '0': 2, '1': 0.2 } },
                            { outs: { '0': 1.8 } },
                        ],
                        [
                            { ins: { '0': 3, '1': 0.3 } },
                            { outs: { '0': 2.7 } },
                        ]
                    )
                }
            )
        })

        describe('*~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with signal as inlet 1 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['*~'], '*~', { value: 1 }),
                            nodeImplementation: nodeImplementations['*~'],
                        },
                        [
                            { ins: { '0': 1, '1': 1 } },
                            { outs: { '0': 1 } },
                        ],
                        [
                            { ins: { '0': 10, '1': 2 } },
                            { outs: { '0': 20 } },
                        ],
                        [
                            { ins: { '0': 100, '1': 3 } },
                            { outs: { '0': 300 } },
                        ]
                    )
                }
            )
        })

        describe('/~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with signal as inlet 1 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['/~'], '/~', { value: 1 }),
                            nodeImplementation: nodeImplementations['/~'],
                        },
                        [
                            { ins: { '0': 1, '1': 1 } },
                            { outs: { '0': 1 } },
                        ],
                        [
                            { ins: { '0': 10, '1': 2 } },
                            { outs: { '0': 5 } },
                        ],
                        [
                            { ins: { '0': 102, '1': 3 } },
                            { outs: { '0': 34 } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should output 0 if division by 0 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['/~'], '/~', { value: 0 }),
                            nodeImplementation: nodeImplementations['/~'],
                        },
                        [{ ins: { '0': 123 } }, { outs: { '0': 0 } }]
                    )
                }
            )
        })

        describe('min~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should output expected result %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['min~'], 'min~', { value: 0 }),
                            nodeImplementation: nodeImplementations['min~'],
                        },
                        [
                            { ins: { '0': 1, '1': -12 } },
                            { outs: { '0': -12 } },
                        ],
                        [
                            { ins: { '0': 2, '1': 0.2 } },
                            { outs: { '0': 0.2 } },
                        ],
                        [
                            { ins: { '0': 3, '1': 55 } },
                            { outs: { '0': 3 } },
                        ]
                    )
                }
            )
        })

        describe('max~', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should output expected result %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['max~'], 'max~', { value: 0 }),
                            nodeImplementation: nodeImplementations['max~'],
                        },
                        [
                            { ins: { '0': 1, '1': -12 } },
                            { outs: { '0': 1 } },
                        ],
                        [
                            { ins: { '0': 2, '1': 0.2 } },
                            { outs: { '0': 2 } },
                        ],
                        [
                            { ins: { '0': 3, '1': 55 } },
                            { outs: { '0': 55 } },
                        ]
                    )
                }
            )
        })

    })
})
