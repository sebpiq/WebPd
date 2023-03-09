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
import { nodeImplementation, builder } from './change'

describe('loadbang', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    initValue: 0,
                })
                testNodeTranslateArgs(builder, [13], {
                    initValue: 13,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output current value on bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'change', {
                            initValue: 12,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [[12]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output only if value is different %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'change', {
                            initValue: 12,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[12]] } }, { outs: { '0': [] } }],
                    [{ ins: { '0': [[13], [13]] } }, { outs: { '0': [[13]] } }],
                    [{ ins: { '0': [[99]] } }, { outs: { '0': [[99]] } }],
                    [{ ins: { '0': [[99]] } }, { outs: { '0': [] } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set new value without outputting %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'change', {
                            initValue: 12,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [['set', 13]] } }, { outs: { '0': [] } }],
                    [{ ins: { '0': [[13]] } }, { outs: { '0': [] } }],
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [[13]] } }],
                )
            }
        )
    })
})
