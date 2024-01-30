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
import { nodeImplementation, builder } from './random'
import assert from 'assert'

describe('random', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    maxValue: 0,
                })
                testNodeTranslateArgs(builder, [11], {
                    maxValue: 11,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should random values in the specified range %s',
            async ({ target, bitDepth }) => {
                const nodeTestSettings = {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'random', {
                        maxValue: 4,
                    }),
                    nodeImplementation,
                }
                const inputFrames = [
                    { ins: { '0': [['bang'], ['bang'], ['bang'], ['bang']] } },
                ]
                const outputFrames =
                    await nodeImplementationsTestHelpers.generateFramesForNode(
                        nodeTestSettings,
                        inputFrames
                    )
                const outValues = outputFrames[0].outs['0'] as Array<any>
                assert.strictEqual(outValues.length, 4)
                outValues.forEach(msg => {
                    assert.strictEqual(msg.length, 1)
                    assert.ok(0 <= msg[0] && msg[0] < 4)
                })
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the max value with outlet 1 %s',
            async ({ target, bitDepth }) => {
                const nodeTestSettings = {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'random', {
                        maxValue: 4,
                    }),
                    nodeImplementation,
                }
                const inputFrames = [
                    { ins: { '1': [[2]] } },
                    { ins: { '0': [['bang'], ['bang'], ['bang'], ['bang']] } },
                ]
                const outputFrames =
                    await nodeImplementationsTestHelpers.generateFramesForNode(
                        nodeTestSettings,
                        inputFrames
                    )
                const outValues = outputFrames[1].outs['0'] as Array<any>
                assert.strictEqual(outValues.length, 4)
                outValues.forEach(msg => {
                    assert.strictEqual(msg.length, 1)
                    assert.ok(0 <= msg[0] && msg[0] < 2)
                })
            }
        )
    })
})
