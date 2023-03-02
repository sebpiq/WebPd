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
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'
import { nodeImplementation, builder } from './list'

describe('list', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    operation: 'append',
                    operationArgs: [],
                })
                testNodeTranslateArgs(builder, ['append', 11, 'blabla'], {
                    operation: 'append',
                    operationArgs: [11, 'blabla'],
                })
            })
        })

        describe('build - split', () => {
            it('should create right amount of portlets', () => {
                testNodeBuild(builder, {
                    operation: 'split',
                    operationArgs: [],
                }, {
                    inlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                    },
                    outlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                        '2': { type: 'message', id: '2' },
                    },
                })
            })
        })

        describe('build - trim', () => {
            it('should create right amount of portlets', () => {
                testNodeBuild(builder, {
                    operation: 'trim',
                    operationArgs: [],
                }, {
                    inlets: {
                        '0': { type: 'message', id: '0' },
                    },
                    outlets: {
                        '0': { type: 'message', id: '0' },
                    },
                })
            })
        })
    })

    describe('implementation - append', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should append input with stored message %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'append',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666]] } },
                        { outs: { '0': [[666, 'blabla', 123]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change stored list on inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'append',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[666]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['hello']] } },
                        { outs: { '0': [['hello', 666]] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should take empty input if sending bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'append',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['blabla', 123]] } },
                    ],
                    [
                        { ins: { '1': [['bang']] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['123', 456]] } },
                        { outs: { '0': [['123', 456]] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if empty output %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'append',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                )
            }
        )
    })

    describe('implementation - prepend', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should prepend input with stored message %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'prepend',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666]] } },
                        { outs: { '0': [['blabla', 123, 666]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change stored list on inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'prepend',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[666]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['hello']] } },
                        { outs: { '0': [[666, 'hello']] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should take empty input if sending bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'prepend',
                            operationArgs: ['blabla', 123],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['blabla', 123]] } },
                    ],
                    [
                        { ins: { '1': [['bang']] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['123', 456]] } },
                        { outs: { '0': [['123', 456]] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if empty output %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'prepend',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                )
            }
        )
    })

    describe('implementation - split', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should split the message at split point %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'split',
                            operationArgs: [2],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, 'hello', '999', 'bla']] } },
                        { outs: { '0': [[666, 'hello']], '1': [['999', 'bla']], '2': [] }, sequence: ['1', '0'] },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change the split point with inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'split',
                            operationArgs: [2],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[1]] } },
                        { outs: { '0': [], '1': [], '2': [] } },
                    ],
                    [
                        { ins: { '0': [[666, 'hello', '999', 'bla']] } },
                        { outs: { '0': [[666]], '1': [['hello', '999', 'bla']], '2': [] }, sequence: ['1', '0'] },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output on last inlet if split point higher than input length %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'split',
                            operationArgs: [9],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, 'hello', '999', 'bla']] } },
                        { outs: { '0': [], '1': [], '2': [[666, 'hello', '999', 'bla']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should turn empty list into a bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'split',
                            operationArgs: [1],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666]] } },
                        { outs: { '0': [[666]], '1': [['bang']], '2': [] }, sequence: ['1', '0'] },
                    ],
                    // change split point to 0
                    [
                        { ins: { '1': [[0]] } },
                        { outs: { '0': [], '1': [], '2': [] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if empty output %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'split',
                            operationArgs: [0],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']], '1': [['bang']], '2': [] } },
                    ],
                )
            }
        )
    })

    describe('implementation - trim', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should do nothing with messages %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'trim',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, 'hello', '999', 'bla'], ['hoho', 888]] } },
                        { outs: { '0': [[666, 'hello', '999', 'bla'], ['hoho', 888]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output bang if empty output %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'trim',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                )
            }
        )
    })

    describe('implementation - length', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send the message length %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'length',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[666, 'hello', '999', 'bla'], ['hoho']] } },
                        { outs: { '0': [[4], [1]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send 0 for bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'list', {
                            operation: 'length',
                            operationArgs: [],
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [[0]] } },
                    ]
                )
            }
        )
    })
})
