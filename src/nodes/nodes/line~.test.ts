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

import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './line~'
import { FrameNodeIn } from '@webpd/compiler/src/test-helpers-node-implementations'
import assert from 'assert'

describe('line~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    initValue: 0,
                })
                testNodeTranslateArgs(builder, [33], {
                    initValue: 33,
                })
            })
        })
    })

    describe('implementation', () => {

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should jump directly to value if no duration provided %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line~', {
                            initValue: 0,
                        }),
                        nodeImplementation: nodeImplementation,
                    },
                    [
                        { ins: { '0': [[12]] } },
                        { outs: { '0': 12 } },
                    ],
                    [
                        { ins: {} },
                        { outs: { '0': 12 } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should ramp to value if duration provided %s',
            async ({ target, bitDepth }) => {
                // Ramp 0 to 10 in 2 * 882 samples
                const inputFrames: Array<FrameNodeIn> = [
                    { ins: { '0': [[882, 40]] } },
                ]
                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                // and then some more
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await nodeImplementationsTestHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line~', {
                            initValue: 0,
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.strictEqual(outputFrames[0].outs['0'], 0)
                assert.strictEqual(outputFrames[882].outs['0'], 441)
                assert.strictEqual(outputFrames[882 * 2].outs['0'], 882)
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should interrupt if setting another ramp in the middle %s',
            async ({ target, bitDepth }) => {
                // Ramp 441 to 0 in 2 * 882 samples
                const inputFrames: Array<FrameNodeIn> = [
                    { ins: { '0': [[0, 40]] } },
                ]
                for (let i = 0; i < 440; i++) {
                    inputFrames.push({})
                }
                // Interrupt at 1/4 with ramp to 882 * 2 = 1764 in 40ms = 2 * 882 samples
                inputFrames.push({ ins: {'0': [[1764 + 330.75, 40]]}})

                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                // and then some more
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await nodeImplementationsTestHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line~', {
                            initValue: 441,
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.strictEqual(outputFrames[0].outs['0'], 441)
                assert.strictEqual(outputFrames[441].outs['0'], 330.75)
                assert.strictEqual(outputFrames[441 + 882].outs['0'], 330.75 + 882)
                assert.strictEqual(outputFrames[441 + 882 + 882].outs['0'], 330.75 + 882 + 882)
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should interrupt if sending stop %s',
            async ({ target, bitDepth }) => {
                // Ramp 882 to 0 in 2 * 882 samples
                const inputFrames: Array<FrameNodeIn> = [
                    { ins: { '0': [[0, 40]] } },
                ]
                for (let i = 0; i < 440; i++) {
                    inputFrames.push({})
                }
                // Interrupt at 1/4
                inputFrames.push({ ins: {'0': [['stop']]}})

                // wait a bit
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }

                const outputFrames = await nodeImplementationsTestHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line~', {
                            initValue: 882,
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.strictEqual(outputFrames[0].outs['0'], 882)
                assert.strictEqual(outputFrames[441].outs['0'], 661.5)
                assert.strictEqual(outputFrames[441 + 8820].outs['0'], 661.5)
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should be able to deal with 2 messages at same frame %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line~', {
                            initValue: 0,
                        }),
                        nodeImplementation: nodeImplementation,
                    },
                    [
                        { ins: { '0': [[882], [0, 20]] } },
                        { outs: { '0': 882 } },
                    ],
                    [
                        { ins: {} },
                        { outs: { '0': 881 } },
                    ],
                )
            }
        )
    })
})
