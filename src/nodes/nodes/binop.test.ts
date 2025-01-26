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

import { builders, nodeImplementations } from './binop'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import * as testHelpers from '@webpd/compiler/src/test-helpers'

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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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

        describe('max', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await testHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['max'], 'max', { value: 1.5 }),
                            nodeImplementation: nodeImplementations['max'],
                        },
                        [{ ins: { '0': [[2], [3], [-1.12], [0]] } }, { outs: { '0': [[2], [3], [1.5], [1.5]] } }],
                    )
                }
            )
        })

        describe('min', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await testHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['min'], 'min', { value: 6.7 }),
                            nodeImplementation: nodeImplementations['min'],
                        },
                        [{ ins: { '0': [[2], [3], [12.8], [100]] } }, { outs: { '0': [[2], [3], [6.7], [6.7]] } }],
                    )
                }
            )
        })

        describe('mod', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await testHelpers.assertNodeOutput(
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

        describe('%', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await testHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['%'], '%', { value: 3 }),
                            nodeImplementation: nodeImplementations['%'],
                        },
                        [{ ins: { '0': [[-1], [3], [-5]] } }, { outs: { '0': [[-1], [0], [-2]] } }],
                    )
                }
            )
        })

        describe('pow', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should work with different values in both inlets %s',
                async ({ target, bitDepth }) => {
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
                    await testHelpers.assertNodeOutput(
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
