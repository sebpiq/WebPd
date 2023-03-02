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
import { nodeImplementation, builder } from './moses'

describe('moses', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    threshold: 0,
                })
                testNodeTranslateArgs(builder, [13], {
                    threshold: 13,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output values on right if >= threshold %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: -12,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[-12], [0], [10.1]] } },
                        { outs: { '0': [], '1': [[-12], [0], [10.1]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output values on left if < threshold %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: -12,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[-12.1], [-19]] } },
                        { outs: { '0': [[-12.1], [-19]], '1': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change the threshold when sending on inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: 9,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[8]] } },
                        { outs: { '0': [[8]], '1': [] } },
                    ],
                    [{ ins: { '1': [[7]] } }, { outs: { '0': [], '1': [] } }],
                    [{ ins: { '0': [[8]] } }, { outs: { '0': [], '1': [[8]] } }]
                )
            }
        )
    })
})
