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
import {
    nodeImplementations,
    builders,
    TOKENIZE_REGEXP,
    tokenizeExpression,
    ExpressionToken,
    renderTokenizedExpression,
    listInputs,
} from './expr-expr~'
import assert from 'assert'
import { VariableNamesIndex } from '@webpd/compiler'

const NODE_TYPES: Array<keyof typeof builders> = ['expr', 'expr~']

describe('expr', () => {
    describe('tokenizeExpression / TOKENIZE_REGEXP', () => {
        it('should parse the expression as expected', () => {
            let match: RegExpMatchArray

            match = TOKENIZE_REGEXP.exec('$s2[12 * $i3] + 1.5 + $f1')
            assert.strictEqual(match.groups['f'], undefined)
            assert.strictEqual(match.groups['v'], undefined)
            assert.strictEqual(match.groups['i'], undefined)
            assert.strictEqual(match.groups['s'], '$s2[12 * $i3]')
            assert.strictEqual(match.groups['sIndex'], '12 * $i3')
            assert.strictEqual(match.groups['id_s'], '2')

            match = TOKENIZE_REGEXP.exec(' + 1.5 + $f1')
            assert.strictEqual(match.groups['f'], '$f1')
            assert.strictEqual(match.groups['v'], undefined)
            assert.strictEqual(match.groups['i'], undefined)
            assert.strictEqual(match.groups['s'], undefined)
            assert.strictEqual(match.groups['sIndex'], undefined)
            assert.strictEqual(match.groups['id_f'], '1')

            match = TOKENIZE_REGEXP.exec('12 * $i3')
            assert.strictEqual(match.groups['f'], undefined)
            assert.strictEqual(match.groups['v'], undefined)
            assert.strictEqual(match.groups['i'], '$i3')
            assert.strictEqual(match.groups['s'], undefined)
            assert.strictEqual(match.groups['sIndex'], undefined)
            assert.strictEqual(match.groups['id_i'], '3')

            match = TOKENIZE_REGEXP.exec('12 * $v1')
            assert.strictEqual(match.groups['f'], undefined)
            assert.strictEqual(match.groups['v'], '$v1')
            assert.strictEqual(match.groups['i'], undefined)
            assert.strictEqual(match.groups['s'], undefined)
            assert.strictEqual(match.groups['sIndex'], undefined)
            assert.strictEqual(match.groups['id_v'], '1')
        })

        it('should tokenize the expression correctly', () => {
            assert.deepStrictEqual<Array<ExpressionToken>>(
                tokenizeExpression('0 + $s2[12 * $i3] + 1.5 + $f1 -$v4 - 0.1'),
                [
                    {
                        type: 'raw',
                        content: '0 + ',
                    },
                    {
                        type: 'string',
                        id: 1,
                    },
                    {
                        type: 'indexing-start',
                    },
                    {
                        type: 'raw',
                        content: '12 * ',
                    },
                    {
                        type: 'int',
                        id: 2,
                    },
                    {
                        type: 'indexing-end',
                    },
                    {
                        type: 'raw',
                        content: ' + 1.5 + ',
                    },
                    {
                        type: 'float',
                        id: 0,
                    },
                    {
                        type: 'raw',
                        content: ' -',
                    },
                    {
                        type: 'signal',
                        id: 3,
                    },
                    {
                        type: 'raw',
                        content: ' - 0.1',
                    },
                ]
            )
        })
    })

    describe('renderTokenizedExpression', () => {
        it('should render the tokenized expression as expected', () => {
            const rendered = renderTokenizedExpression(
                'STATE',
                { '0': 'IN0' },
                [
                    {
                        type: 'string',
                        id: 1,
                    },
                    {
                        type: 'indexing-start',
                    },
                    {
                        type: 'raw',
                        content: '12 * ',
                    },
                    {
                        type: 'int',
                        id: 2,
                    },
                    {
                        type: 'indexing-end',
                    },
                    {
                        type: 'raw',
                        content: ' + 1.5 + ',
                    },
                    {
                        type: 'float',
                        id: 0,
                    },
                    {
                        type: 'raw',
                        content: ' + ',
                    },
                    {
                        type: 'signal',
                        id: 0,
                    },
                ],
                {
                    numbers: { roundFloatAsPdInt: 'roundFloatAsPdInt' },
                    commons: { getArray: 'getArray' }
                } as unknown as VariableNamesIndex['globals']
            )
            assert.strictEqual(
                rendered,
                '+(getArray(STATE.stringInputs.get(1))' +
                    '[toInt(12 * roundFloatAsPdInt(STATE.floatInputs.get(2)))]' +
                    ' + 1.5 + STATE.floatInputs.get(0) + IN0)'
            )
        })
    })

    describe('listInputs', () => {
        it('should list the inputs from tokenizedExpression', () => {
            assert.deepStrictEqual(
                listInputs([
                    [
                        {
                            type: 'string',
                            id: 1,
                        },
                        {
                            type: 'indexing-start',
                        },
                        {
                            type: 'raw',
                            content: '12 * ',
                        },
                        {
                            type: 'int',
                            id: 2,
                        },
                        {
                            type: 'indexing-end',
                        },
                        {
                            type: 'raw',
                            content: ' + 1.5 + ',
                        },
                        {
                            type: 'float',
                            id: 3,
                        },
                        {
                            type: 'raw',
                            content: ' * ',
                        },
                        {
                            type: 'float',
                            id: 3,
                        },
                        {
                            type: 'raw',
                            content: ' + ',
                        },
                        {
                            type: 'signal',
                            id: 0,
                        },
                    ],
                ]),
                [
                    {
                        type: 'signal',
                        id: 0,
                    },
                    {
                        type: 'string',
                        id: 1,
                    },
                    {
                        type: 'int',
                        id: 2,
                    },
                    {
                        type: 'float',
                        id: 3,
                    },
                ]
            )
        })

        it('should raise an error if contradictory definitions for an input', () => {
            assert.throws(() =>
                listInputs([
                    [
                        {
                            type: 'float',
                            id: 0,
                        },
                        {
                            type: 'raw',
                            content: ' * ',
                        },
                        {
                            type: 'signal',
                            id: 0,
                        },
                    ],
                ])
            )
        })
    })

    describe('builder', () => {
        describe('translateArgs', () => {
            it.each(NODE_TYPES)(
                'should parse the expressions inputs',
                (nodeType) => {
                    testNodeTranslateArgs(
                        builders[nodeType],
                        ['$s2', '[$i3]', '+', 1, '+', '$f1'],
                        {
                            tokenizedExpressions: [
                                [
                                    {
                                        type: 'string',
                                        id: 1,
                                    },
                                    {
                                        type: 'indexing-start',
                                    },
                                    {
                                        type: 'int',
                                        id: 2,
                                    },
                                    {
                                        type: 'indexing-end',
                                    },
                                    {
                                        type: 'raw',
                                        content: ' + 1 + ',
                                    },
                                    {
                                        type: 'float',
                                        id: 0,
                                    },
                                ],
                            ],
                        }
                    )
                }
            )

            it.each(NODE_TYPES)('should prefix math functions', (nodeType) => {
                testNodeTranslateArgs(
                    builders[nodeType],
                    ['$f1 + sin($f2)+ min($f1, 3)'],
                    {
                        tokenizedExpressions: [
                            [
                                {
                                    type: 'float',
                                    id: 0,
                                },
                                {
                                    type: 'raw',
                                    content: ' + Math.sin(',
                                },
                                {
                                    type: 'float',
                                    id: 1,
                                },
                                { content: ')+ Math.min(', type: 'raw' },
                                { id: 0, type: 'float' },
                                { content: ', 3)', type: 'raw' },
                            ],
                        ],
                    }
                )
            })

            it.each(NODE_TYPES)('should split expressions', (nodeType) => {
                testNodeTranslateArgs(
                    builders[nodeType],
                    ['$f1', '+', 1, ';', '$s2', '[$i3]'],
                    {
                        tokenizedExpressions: [
                            [
                                {
                                    type: 'float',
                                    id: 0,
                                },
                                {
                                    type: 'raw',
                                    content: ' + 1',
                                },
                            ],
                            [
                                {
                                    type: 'string',
                                    id: 1,
                                },
                                {
                                    type: 'indexing-start',
                                },
                                {
                                    type: 'int',
                                    id: 2,
                                },
                                {
                                    type: 'indexing-end',
                                },
                            ],
                        ],
                    }
                )
            })
        })

        describe('expr.build', () => {
            it('should have right number of inlets / outlets', () => {
                testNodeBuild(
                    builders['expr'],
                    {
                        tokenizedExpressions: [
                            [
                                {
                                    type: 'float',
                                    id: 0,
                                },
                            ],
                            [
                                {
                                    type: 'string',
                                    id: 1,
                                },
                                {
                                    type: 'indexing-start',
                                },
                                {
                                    type: 'int',
                                    id: 2,
                                },
                                {
                                    type: 'indexing-end',
                                },
                            ],
                        ],
                    },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                            '2': { type: 'message', id: '2' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                            '1': { type: 'message', id: '1' },
                        },
                    }
                )
            })
        })

        describe('expr~.build', () => {
            it('should have right number of inlets / outlets', () => {
                testNodeBuild(
                    builders['expr~'],
                    {
                        tokenizedExpressions: [
                            [
                                {
                                    type: 'float',
                                    id: 3,
                                },
                                {
                                    type: 'raw',
                                    content: ' + ',
                                },
                                {
                                    type: 'signal',
                                    id: 0,
                                },
                            ],
                            [
                                {
                                    type: 'string',
                                    id: 1,
                                },
                                {
                                    type: 'indexing-start',
                                },
                                {
                                    type: 'int',
                                    id: 2,
                                },
                                {
                                    type: 'indexing-end',
                                },
                            ],
                        ],
                    },
                    {
                        inlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'message', id: '1' },
                            '2': { type: 'message', id: '2' },
                            '3': { type: 'message', id: '3' },
                        },
                        outlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output the specified calculations %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr'], 'expr', {
                            tokenizedExpressions: [
                                tokenizeExpression('$f1 + 1'),
                                tokenizeExpression('$s2[$i3]'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr'],
                        arrays: {
                            ARRAY1: [0.1, 0.2, 0.3],
                        },
                    },
                    [
                        { ins: { '1': [['ARRAY1']], '2': [[1.9]] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [
                        { ins: { '0': [[11]] } },
                        { outs: { '0': [[12]], '1': [[0.2]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should have default values set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr'], 'expr', {
                            tokenizedExpressions: [
                                // default values 0 for float and int, "" for string
                                tokenizeExpression('$f1 + $s2[$i3]'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr'],
                        arrays: {
                            '': [0.1, 0.2, 0.3],
                        },
                    },
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [[0.1]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should work with signal %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr~'], 'expr~', {
                            tokenizedExpressions: [
                                tokenizeExpression(
                                    '$f2 + Math.abs(Math.sin($v1))'
                                ),
                                tokenizeExpression('$f2 + 0.1'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr~'],
                    },
                    [
                        { ins: { '0': Math.PI / 2, '1': [[10]] } },
                        {
                            outs: {
                                '0': 11,
                                '1': 10.1,
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output latest results on bang %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr'], 'expr', {
                            tokenizedExpressions: [
                                tokenizeExpression('$f1 + $i2'),
                                tokenizeExpression('$i2 + 0.5'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr'],
                    },
                    [
                        { ins: { '1': [[-19.5]] } },
                        { outs: { '0': [], '1': [] } },
                    ],
                    [
                        { ins: { '0': [[11]] } },
                        { outs: { '0': [[-8]], '1': [[-18.5]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should unpack list on inlet 0 %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr'], 'expr', {
                            tokenizedExpressions: [
                                tokenizeExpression('$f1 + $s3[$i2]'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr'],
                        arrays: {
                            ARRAY: [0.1, 0.2, 0.3],
                        },
                    },
                    [
                        { ins: { '0': [[10, 2, 'ARRAY']] } },
                        { outs: { '0': [[10.3]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should work with math functions %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr'], 'expr', {
                            tokenizedExpressions: [
                                tokenizeExpression('Math.abs(Math.sin($f1))'),
                                tokenizeExpression('Math.sin($f1)'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr'],
                    },
                    [
                        { ins: { '0': [[0], [Math.PI / 2], [-Math.PI / 2]] } },
                        {
                            outs: {
                                '0': [[0], [1], [1]],
                                '1': [[0], [1], [-1]],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should convert output to float %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['expr~'], 'expr~', {
                            tokenizedExpressions: [
                                tokenizeExpression('$v1>=0.5'),
                            ],
                        }),
                        nodeImplementation: nodeImplementations['expr~'],
                    },
                    [
                        { ins: { '0': 22 } },
                        {
                            outs: {
                                '0': 1,
                            },
                        },
                    ],
                    [
                        { ins: { '0': 0.2 } },
                        {
                            outs: {
                                '0': 0,
                            },
                        },
                    ]
                )
            }
        )
    })
})
