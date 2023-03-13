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
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'
import { nodeImplementations, builders } from './funcs'

describe('funcs', () => {
    describe('implementation', () => {
        describe('abs', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['abs'], 'abs', {}),
                            nodeImplementation: nodeImplementations['abs'],
                        },
                        [
                            { ins: { '0': [[2.9], [-0.9], [0]] } },
                            { outs: { '0': [[2.9], [0.9], [0]] } },
                        ]
                    )
                }
            )
        })

        describe('wrap', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['wrap'], 'wrap', {}),
                            nodeImplementation: nodeImplementations['wrap'],
                        },
                        [
                            { ins: { '0': [[2.9], [-0.9], [-1], [0], [10]] } },
                            { outs: { '0': [[0.9], [0.1], [0], [0], [0]] } },
                        ]
                    )
                }
            )
        })

        describe('cos', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['cos'], 'cos', {}),
                            nodeImplementation: nodeImplementations['cos'],
                        },
                        [
                            { ins: { '0': [[0], [Math.PI]] } },
                            { outs: { '0': [[1], [-1]] } },
                        ]
                    )
                }
            )
        })

        describe('sqrt', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['sqrt'], 'sqrt', {}),
                            nodeImplementation: nodeImplementations['sqrt'],
                        },
                        [
                            { ins: { '0': [[9], [-0.9], [0], [4]] } },
                            { outs: { '0': [[3], [0], [0], [2]] } },
                        ]
                    )
                }
            )
        })

        describe('mtof', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['mtof'], 'mtof', {}),
                            nodeImplementation: nodeImplementations['mtof'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        // < -1500
                                        [-1790],

                                        // >= 1500
                                        [1500],

                                        // -1500 < val < 1500
                                        [69],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [0],
                                        [
                                            8.17579891564 *
                                                Math.exp(0.057762265 * 1499),
                                        ],
                                        [440],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('ftom', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['ftom'], 'ftom', {}),
                            nodeImplementation: nodeImplementations['ftom'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        [440],
                                        [880],

                                        // < 0
                                        [0],

                                        // -1500 < val < 1500
                                        [-1],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [69],
                                        [81],
                                        [-1500],
                                        [-1500],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('rmstodb', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['rmstodb'], 'rmstodb', {}),
                            nodeImplementation: nodeImplementations['rmstodb'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        [1],
                                        [10],
                                        [100],
                                        [0.1],
                                        [0.01],
                                        // non-positif test cases
                                        [0],
                                        [-5],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [100],
                                        [120],
                                        [140],
                                        [80],
                                        [60],
                                        [0],
                                        [0],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('dbtorms', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['dbtorms'], 'dbtorms', {}),
                            nodeImplementation: nodeImplementations['dbtorms'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        [100],
                                        [120],
                                        [140],
                                        [80],
                                        [60],
                                        // non-positif test cases
                                        [0],
                                        [-5],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [1],
                                        [10],
                                        [100],
                                        [0.1],
                                        [0.01],
                                        [0],
                                        [0],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('powtodb', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['powtodb'], 'powtodb', {}),
                            nodeImplementation: nodeImplementations['powtodb'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        [1],
                                        [10],
                                        [100],
                                        [0.1],
                                        [0.01],
                                        // non-positif test cases
                                        [0],
                                        [-5],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [100],
                                        [110],
                                        [120],
                                        [90],
                                        [80],
                                        [0],
                                        [0],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('dbtopow', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should apply the expected function %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['dbtopow'], 'dbtopow', {}),
                            nodeImplementation: nodeImplementations['dbtopow'],
                        },
                        [
                            {
                                ins: {
                                    '0': [
                                        [100],
                                        [110],
                                        [120],
                                        [90],
                                        [80],
                                        // non-positif test cases
                                        [0],
                                        [-5],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [1],
                                        [10],
                                        [100],
                                        [0.1],
                                        [0.01],
                                        [0],
                                        [0],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

    })
})
