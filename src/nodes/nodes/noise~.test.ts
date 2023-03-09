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

import assert from 'assert'
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
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
