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
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'
import { nodeImplementation, builder } from './timer'

const SAMPLE_RATE = nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS.sampleRate

describe('timer', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    unitAmount: 1,
                    unit: 'msec',
                })
                testNodeTranslateArgs(builder, [13, 'seconds'], {
                    unitAmount: 13,
                    unit: 'seconds',
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time since beginning if not banged %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[3]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time since last time banged on inlet 0 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[1]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time in the unit that was configured %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{ins: { '0': [['tempo', 2/SAMPLE_RATE, 'seconds']] }}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[2.5]] } }],
                )
            }
        )
    })
})
