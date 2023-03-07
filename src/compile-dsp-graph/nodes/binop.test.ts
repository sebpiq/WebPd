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
import { builders, nodeImplementations } from './binop'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'

describe('binop', () => {
    describe('builders', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builders['+'], [], { value: 0 })
                testNodeTranslateArgs(builders['-'], [], { value: 0 })
                testNodeTranslateArgs(builders['*'], [], { value: 1 })
                testNodeTranslateArgs(builders['/'], [], { value: 1 })
            })
        })
    })

    describe('implementation', () => {
        describe('shared tests', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with bang to inlet 0 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['+'], '+', {
                                value: -0.1,
                            }),
                            nodeImplementation: nodeImplementations['+'],
                        },
                        [{ ins: { '0': [[1]] } }, { outs: { '0': [[0.9]] } }],
                        [{ ins: { '1': [[0.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[1.1]] } },
                        ]
                    )
                }
            )
        })

        describe('+', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['+'], '+', { value: 10 }),
                            nodeImplementation: nodeImplementations['+'],
                        },
                        [{ ins: { '0': [[1]] } }, { outs: { '0': [[11]] } }],
                        [{ ins: { '1': [[0.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[3], [-3]] } },
                            { outs: { '0': [[3.1], [-2.9]] } },
                        ],
                        [{ ins: { '1': [[-10.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[5], [-5]] } },
                            { outs: { '0': [[-5.1], [-15.1]] } },
                        ]
                    )
                }
            )
        })

        describe('-', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['-'], '-', { value: 10 }),
                            nodeImplementation: nodeImplementations['-'],
                        },
                        [{ ins: { '0': [[1]] } }, { outs: { '0': [[-9]] } }],
                        [{ ins: { '1': [[0.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[3], [-3]] } },
                            { outs: { '0': [[2.9], [-3.1]] } },
                        ],
                        [{ ins: { '1': [[-10.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[5], [-5]] } },
                            { outs: { '0': [[15.1], [5.1]] } },
                        ]
                    )
                }
            )
        })

        describe('*', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['*'], '*', { value: 10 }),
                            nodeImplementation: nodeImplementations['*'],
                        },
                        [{ ins: { '0': [[2]] } }, { outs: { '0': [[20]] } }],
                        [{ ins: { '1': [[0.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[3], [-3]] } },
                            { outs: { '0': [[0.3], [-0.3]] } },
                        ],
                        [{ ins: { '1': [[-1.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[5], [-5]] } },
                            { outs: { '0': [[-5.5], [5.5]] } },
                        ]
                    )
                }
            )
        })

        describe('/', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['/'], '/', { value: 10 }),
                            nodeImplementation: nodeImplementations['/'],
                        },
                        [{ ins: { '0': [[2]] } }, { outs: { '0': [[0.2]] } }],
                        [{ ins: { '1': [[0.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[3], [-3]] } },
                            { outs: { '0': [[30], [-30]] } },
                        ],
                        [{ ins: { '1': [[-2]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[5], [-5]] } },
                            { outs: { '0': [[-2.5], [2.5]] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should return 0 if division by 0 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['/'], '/', { value: 0 }),
                            nodeImplementation: nodeImplementations['/'],
                        },
                        [{ ins: { '0': [[5]] } }, { outs: { '0': [[0]] } }]
                    )
                }
            )
        })

        describe('mod', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['mod'], 'mod', {
                                value: 3,
                            }),
                            nodeImplementation: nodeImplementations['mod'],
                        },
                        [
                            { ins: { '0': [[2], [3], [4]] } },
                            { outs: { '0': [[2], [0], [1]] } },
                        ],
                        [{ ins: { '1': [[2]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[2], [3], [4]] } },
                            { outs: { '0': [[0], [1], [0]] } },
                        ],

                        // Modulo 0
                        [{ ins: { '1': [[0]] } }, { outs: { '0': [] } }],
                        [{ ins: { '0': [[5], [-5]] } }, { outs: { '0': [[0], [0]] } }],

                        // Int modulo with non-int values on left
                        [{ ins: { '1': [[3]] } }, { outs: { '0': [] } }],
                        [{ ins: { '0': [[-0.9], [-1.8], [-2.2], [1.1], [2.9]] } }, { outs: { '0': [[0], [2], [1], [1], [2]] } }],

                        // non-int + negative values
                        [{ ins: { '1': [[3]] } }, { outs: { '0': [] } }],
                        [
                            {
                                ins: {
                                    '0': [
                                        [-3],
                                        [-2],
                                        [-1],
                                        [0],
                                        [1],
                                        [2],
                                        [3],
                                        [4],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [0],
                                        [1],
                                        [2],
                                        [0],
                                        [1],
                                        [2],
                                        [0],
                                        [1],
                                    ],
                                },
                            },
                        ],
                        [{ ins: { '1': [[-2.9]] } }, { outs: { '0': [] } }],
                        [
                            {
                                ins: {
                                    '0': [
                                        [-3],
                                        [-2],
                                        [-1],
                                        [0],
                                        [1],
                                        [2],
                                        [3],
                                        [4],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                    ],
                                },
                            },
                        ],
                        [{ ins: { '1': [[2.4]] } }, { outs: { '0': [] } }],
                        [
                            {
                                ins: {
                                    '0': [
                                        [-3],
                                        [-2],
                                        [-1],
                                        [0],
                                        [1],
                                        [2],
                                        [3],
                                        [4],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                        [1],
                                        [0],
                                    ],
                                },
                            },
                        ]
                    )
                }
            )
        })

        describe('pow', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['pow'], 'pow', { value: 4 }),
                            nodeImplementation: nodeImplementations['pow'],
                        },
                        
                        // Positive float number, int exponent
                        [
                            { ins: { '0': [[2], [3], [4], [0.9], [2.5]] } },
                            { outs: { '0': [[16], [81], [256], [0.6561], [39.0625]] } },
                        ],

                        // Negative number, int exponent
                        [{ ins: { '1': [[-3]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[-2], [-1.2]] } },
                            { outs: { '0': [[-0.125], [-0.5787]] } },
                        ],

                        // Negative number, float exponent
                        [{ ins: { '1': [[3.1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[-2], [-1.2], [0]] } },
                            { outs: { '0': [[0], [0], [0]] } },
                        ],

                        // Zero
                        [{ ins: { '1': [[0]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[-2], [-1.2], [1000]] } },
                            { outs: { '0': [[1], [1], [1]] } },
                        ]
                    )
                }
            )
        })

        describe('||', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['||'], '||', { value: 0 }),
                            nodeImplementation: nodeImplementations['||'],
                        },
                        [
                            {
                                ins: {
                                    '0': [[0.9], [10], [0], [1], [-0.9], [-2]],
                                },
                            },
                            { outs: { '0': [[0], [1], [0], [1], [0], [1]] } },
                        ],
                        [{ ins: { '1': [[0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[0.9], [10]] } },
                            { outs: { '0': [[0], [1]] } },
                        ],
                        [{ ins: { '1': [[2]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[0.9], [10], [0], [-0.9]] } },
                            { outs: { '0': [[1], [1], [1], [1]] } },
                        ]
                    )
                }
            )
        })

        describe('&&', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['&&'], '&&', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['&&'],
                        },
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2]] } },
                            { outs: { '0': [[0], [0], [0], [0]] } },
                        ],
                        [{ ins: { '1': [[0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [0], [-2]] } },
                            { outs: { '0': [[0], [0], [0]] } },
                        ],
                        [{ ins: { '1': [[2]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2.9]] } },
                            { outs: { '0': [[0], [1], [0], [1]] } },
                        ]
                    )
                }
            )
        })

        describe('>', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['>'], '>', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['>'],
                        },
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2]] } },
                            { outs: { '0': [[1], [1], [0], [0]] } },
                        ],
                        [{ ins: { '1': [[-1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [0], [-2]] } },
                            { outs: { '0': [[1], [1], [0]] } },
                        ],
                    )
                }
            )
        })
        
        describe('>=', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['>='], '>=', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['>='],
                        },
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2]] } },
                            { outs: { '0': [[1], [1], [1], [0]] } },
                        ],
                        [{ ins: { '1': [[-1]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [0], [-2]] } },
                            { outs: { '0': [[1], [1], [0]] } },
                        ],
                    )
                }
            )
        })

        describe('<', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['<'], '<', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['<'],
                        },
                        [
                            { ins: { '0': [[-19], [10], [0], [-2.333]] } },
                            { outs: { '0': [[1], [0], [0], [1]] } },
                        ],
                        [{ ins: { '1': [[0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [0], [-2]] } },
                            { outs: { '0': [[0], [1], [1]] } },
                        ],
                        [{ ins: { '1': [[-2]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[0.9], [-10], [0], [-2.9]] } },
                            { outs: { '0': [[0], [1], [0], [1]] } },
                        ]
                    )
                }
            )
        })

        describe('<=', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['<='], '<=', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['<='],
                        },
                        [
                            { ins: { '0': [[-19], [10], [0], [-2.333]] } },
                            { outs: { '0': [[1], [0], [1], [1]] } },
                        ],
                        [{ ins: { '1': [[0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [0.9], [-2]] } },
                            { outs: { '0': [[0], [1], [1]] } },
                        ],
                    )
                }
            )
        })

        describe('==', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['=='], '==', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['=='],
                        },
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2]] } },
                            { outs: { '0': [[0], [0], [1], [0]] } },
                        ],
                        [{ ins: { '1': [[-0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [-0.9], [-2]] } },
                            { outs: { '0': [[0], [1], [0]] } },
                        ],
                    )
                }
            )
        })

        describe('!=', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['!='], '!=', {
                                value: 0,
                            }),
                            nodeImplementation: nodeImplementations['!='],
                        },
                        [
                            { ins: { '0': [[0.9], [10], [0], [-2]] } },
                            { outs: { '0': [[1], [1], [0], [1]] } },
                        ],
                        [{ ins: { '1': [[-0.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [[10], [-0.9], [-2]] } },
                            { outs: { '0': [[1], [0], [1]] } },
                        ],
                    )
                }
            )
        })
    })
})