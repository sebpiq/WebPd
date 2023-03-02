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
import { nodeImplementation, builder } from './clip~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'

describe('clip~', () => {
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
            'should sum incoming signals together %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip~', {
                            minValue: -1.5,
                            maxValue: 2.5,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2 } }, { outs: { '0': 1.2 } }],
                    [{ ins: { '0': -1.5 } }, { outs: { '0': -1.5 } }],
                    [{ ins: { '0': -2 } }, { outs: { '0': -1.5 } }],
                    [{ ins: { '0': 2.6 } }, { outs: { '0': 2.5 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should take incoming message on input %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip~', {
                            minValue: -1.5,
                            maxValue: 2.5,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0_message': [[1.2]] } }, { outs: { '0': 1.2 } }],
                    [{ ins: { '0_message': [[2.6]] } }, { outs: { '0': 2.5 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change min max on message inlets %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip~', {
                            minValue: -1.5,
                            maxValue: 2.5,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': 1.1, '1': [[-0.5]], '2': [[0.5]] } },
                        { outs: { '0': 0.5 } },
                    ],
                    [{ ins: { '0': -1.5 } }, { outs: { '0': -0.5 } }]
                )
            }
        )
    })
})
