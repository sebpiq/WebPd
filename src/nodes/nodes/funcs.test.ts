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
