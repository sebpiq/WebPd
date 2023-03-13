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

import assert from 'assert'
import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'
import { nodeImplementation, builder } from './noise~'

describe('noise~', () => {

    describe('implementation', () => {
        const testOutputFrames = (
            frames: Array<nodeImplementationsTestHelpers.FrameNodeOut>
        ) => {
            const values = new Set(frames.map((frame) => frame.outs['0']))
            values.forEach((value) => {
                assert.ok(-1 < value && value < 1)
            })
            // Test that all values are different
            assert.deepStrictEqual(values.size, 3)
        }
    
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should output white noise %s', async ({ target, bitDepth}) => {
            const nodeTestSettings = {
                target,
                bitDepth,
                node: buildNode(builder, 'noise~', {}),
                nodeImplementation,
            }
            const inputFrames = [{}, {}, {}]
            testOutputFrames(
                await nodeImplementationsTestHelpers.generateFramesForNode(
                    nodeTestSettings,
                    inputFrames
                )
            )
        })
    })
})
