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
import { nodeImplementation, builder } from './trigger'

describe('loadbang', () => {
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
            'should the expected values %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
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
