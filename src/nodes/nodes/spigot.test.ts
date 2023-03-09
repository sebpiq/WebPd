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
import { nodeImplementation, builder } from './spigot'

describe('spigot', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], { isClosed: true })
                testNodeTranslateArgs(builder, [10], { isClosed: false })
                testNodeTranslateArgs(builder, [0], { isClosed: true })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should bypass when open %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: false }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[13, 'blabla'], [0]] } },
                        { outs: { '0': [[13, 'blabla'], [0]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should block when closed %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: true }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[13, 'blabla'], [0]] } },
                        { outs: { '0': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should open / close with inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: false }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[0]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '1': [[1]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                )
            }
        )
    })
})
