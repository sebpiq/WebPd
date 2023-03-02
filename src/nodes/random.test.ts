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
                    node: buildNode(builder, 'noise~', {
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
                    node: buildNode(builder, 'noise~', {
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
