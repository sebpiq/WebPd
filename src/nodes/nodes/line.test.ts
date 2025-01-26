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

import { Message } from '@webpd/compiler'
import * as testHelpers from '@webpd/compiler/src/test-helpers'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './line'
import assert from 'assert'

describe('line', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    initValue: 0,
                    timeGrainMsec: 20,
                })
                testNodeTranslateArgs(builder, [33, 1], {
                    initValue: 33,
                    timeGrainMsec: 20,
                })
            })
        })
    })

    describe('implementation', () => {

        const gatherOuts = (outputFrames: Array<testHelpers.FrameNodeOut>) => {
            const nonEmptyFrames: {[frame: number]: Array<Message>} = {}
            outputFrames.forEach((frame, i) => {
                const frameOut0 = frame.outs['0'] as Array<Message>
                if (frameOut0.length) {
                    nonEmptyFrames[i] = frameOut0
                }
            })
            return nonEmptyFrames
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should jump directly to value if no duration provided %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 0,
                            timeGrainMsec: 20,
                        }),
                        nodeImplementation: nodeImplementation,
                    },
                    [
                        { ins: { '0': [[12]] } },
                        { outs: { '0': [[12]] } },
                    ],
                    [
                        { ins: {} },
                        { outs: { '0': [] } },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should ramp to value if duration provided %s',
            async ({ target, bitDepth }) => {
                // Ramp 0 to 10 in 2 * 882 samples
                const inputFrames: Array<testHelpers.FrameNodeIn> = [
                    { ins: { '0': [[10, 40]] } },
                ]
                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                // and then some more
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await testHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 0,
                            timeGrainMsec: 20, // 882 samples
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.deepStrictEqual(gatherOuts(outputFrames), {
                    [0]: [[0]],
                    [882]: [[5]],
                    [882 * 2]: [[10]],
                })
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should interrupt if setting another ramp in the middle %s',
            async ({ target, bitDepth }) => {
                // Ramp 10 to 0 in 2 * 882 samples
                const inputFrames: Array<testHelpers.FrameNodeIn> = [
                    { ins: { '0': [[0, 40]] } },
                ]
                for (let i = 0; i < 440; i++) {
                    inputFrames.push({})
                }
                // Interrupt at 1/4 with ramp to 40 in 40ms = 2 * 882 samples
                inputFrames.push({ ins: {'0': [[47.5, 40]]}})

                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                // and then some more
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await testHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 10,
                            timeGrainMsec: 20, // 882 samples
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.deepStrictEqual(gatherOuts(outputFrames), {
                    [0]: [[10]],
                    [441]: [[7.5]],
                    [441 + 882]: [[7.5 + 20]],
                    [441 + 882 + 882]: [[7.5 + 40]],
                })
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set grain if 3 floats to first inlet %s',
            async ({ target, bitDepth }) => {
                // Ramp 1 to 11 in 4 * 882 samples, grain 2 * 882 samples
                const inputFrames: Array<testHelpers.FrameNodeIn> = [
                    { ins: { '0': [[11, 80, 40]] } },
                ]
                for (let i = 0; i < 10 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await testHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 1,
                            timeGrainMsec: 20, // 882 samples
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.deepStrictEqual(gatherOuts(outputFrames), {
                    [0]: [[1]],
                    [882 * 2]: [[6]],
                    [882 * 4]: [[11]],
                })
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should interrupt if sending stop %s',
            async ({ target, bitDepth }) => {
                // Ramp 10 to 0 in 2 * 882 samples
                const inputFrames: Array<testHelpers.FrameNodeIn> = [
                    { ins: { '0': [[0, 40]] } },
                ]
                for (let i = 0; i < 440; i++) {
                    inputFrames.push({})
                }
                // Interrupt at 1/4
                inputFrames.push({ ins: {'0': [['stop']]}})

                // wait a bit
                for (let i = 0; i < 10 * 882 - 1; i++) {
                    inputFrames.push({})
                }

                // Ramp 7.5 to 17.5 in 2 * 882 samples
                inputFrames.push(
                    { ins: { '0': [[17.5, 40]] } },
                )
                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await testHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 10,
                            timeGrainMsec: 20, // 882 samples
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.deepStrictEqual(gatherOuts(outputFrames), {
                    [0]: [[10]],
                    [441 + 8820]: [[7.5]],
                    [441 + 8820 + 882]: [[7.5 + 5]],
                    [441 + 8820 + 882 + 882]: [[7.5 + 10]],
                })
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should interrupt if sending set %s',
            async ({ target, bitDepth }) => {
                // Ramp 10 to 0 in 2 * 882 samples
                const inputFrames: Array<testHelpers.FrameNodeIn> = [
                    { ins: { '0': [[0, 40]] } },
                ]
                for (let i = 0; i < 440; i++) {
                    inputFrames.push({})
                }
                // Interrupt at 1/4
                inputFrames.push({ ins: {'0': [['set', 0]]}})

                // wait a bit
                for (let i = 0; i < 10 * 882 - 1; i++) {
                    inputFrames.push({})
                }

                // Ramp 0 to 10 in 2 * 882 samples
                inputFrames.push(
                    { ins: { '0': [[10, 40]] } },
                )
                // go to end of line
                for (let i = 0; i < 2 * 882; i++) {
                    inputFrames.push({})
                }
                
                const outputFrames = await testHelpers.generateFramesForNode(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'line', {
                            initValue: 10,
                            timeGrainMsec: 20, // 882 samples
                        }),
                        nodeImplementation,
                    },
                    inputFrames
                )

                assert.deepStrictEqual(gatherOuts(outputFrames), {
                    [0]: [[10]],
                    [441 + 8820]: [[0]],
                    [441 + 8820 + 882]: [[5]],
                    [441 + 8820 + 882 + 882]: [[10]],
                })
            }
        )
    })
})
