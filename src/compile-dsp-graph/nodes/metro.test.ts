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
import { nodeImplementation, builder } from './metro'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'

const SAMPLE_RATE = nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS.sampleRate

describe('metro', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builder, [], {
                    rate: 0,
                    unit: 'msec',
                    unitAmount: 1,
                })
                testNodeTranslateArgs(builder, [100, 10, 'seconds'], {
                    rate: 100,
                    unit: 'seconds',
                    unitAmount: 10,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should start metro at rate passed as arg %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: (2 * 1000) / SAMPLE_RATE,
                            unit: 'msec',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: {} }, { outs: { '0': [] } }],
                    [{ ins: {} }, { outs: { '0': [] } }],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                    [{ ins: {} }, { outs: { '0': [] } }],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should start metro when sent 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: 1,
                            unit: 'samp',
                            unitAmount: 2,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[1]] } }, { outs: { '0': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': [] } }],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should start metro at rate passed to inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: (2 * 1000) / SAMPLE_RATE,
                            unit: 'msec',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                    [{ ins: {} }, { outs: { '0': [] } }],
                    [
                        { ins: { '1': [[1000 / SAMPLE_RATE]] } },
                        { outs: { '0': [['bang']] } },
                    ],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop metro when receiving stop %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: (1 * 1000) / SAMPLE_RATE,
                            unit: 'msec',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }],
                    [{ ins: { '0': [['stop']] } }, { outs: { '0': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should stop metro when receiving 0 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: (1 * 1000) / SAMPLE_RATE,
                            unit: 'msec',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                    [{ ins: {} }, { outs: { '0': [['bang']] } }],
                    [{ ins: { '0': [[0]] } }, { outs: { '0': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output several times if banged several times at same frame %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'metro', {
                            rate: 10,
                            unit: 'samp',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [['bang'], ['bang'], ['bang']] } }, { outs: { '0': [['bang'], ['bang'], ['bang']] } }],
                )
            }
        )
    })
})
