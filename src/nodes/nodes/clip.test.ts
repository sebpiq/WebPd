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
} from '../test-helpers'
import { nodeImplementation, builder } from './clip'

describe('clip', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    minValue: 0,
                    maxValue: 0,
                })
                testNodeTranslateArgs(builder, [-10, 11], {
                    minValue: -10,
                    maxValue: 11,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output clipped values %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip', {
                            minValue: -12,
                            maxValue: 4.5,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[-13], [0], [10.1], [-12], [4.5], [3.33]] } },
                        { outs: { '0': [[-12], [0], [4.5], [-12], [4.5], [3.33]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change min and max values when sending on inlet 1 and 2 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip', {
                            minValue: -12,
                            maxValue: 4.5,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[9.8]], '2': [[13333]] } },
                        { outs: { '0': [] } },
                    ],
                    [{ ins: { '0': [[7], [2222], [14000]] } }, { outs: { '0': [[9.8], [2222], [13333]] } }],
                )
            }
        )
    })
})
