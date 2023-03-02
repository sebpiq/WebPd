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
import { nodeImplementations, builders } from './funcs~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../nodes-shared-code/test-helpers'

describe('func~', () => {
    describe('implementation abs~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['abs~'], 'abs~', {
                            channelCount: 3,
                        }),
                        nodeImplementation: nodeImplementations['abs~'],
                    },
                    [{ ins: { '0': 10 } }, { outs: { '0': 10 } }],
                    [{ ins: { '0': -20 } }, { outs: { '0': 20 } }]
                )
            }
        )
    })
    describe('implementation cos~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['cos~'], 'cos~', {
                            channelCount: 3,
                        }),
                        nodeImplementation: nodeImplementations['cos~'],
                    },
                    [{ ins: { '0': -1 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 0 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 1 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 2 } }, { outs: { '0': 1 } }],
                    [{ ins: { '0': 0.5 } }, { outs: { '0': -1 } }],
                    [{ ins: { '0': 0.25 } }, { outs: { '0': 0 } }]
                )
            }
        )
    })

    describe('implementation wrap~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['wrap~'], 'wrap~', {}),
                        nodeImplementation: nodeImplementations['wrap~'],
                    },
                    [
                        { ins: { '0': 2.9 } },
                        { outs: { '0': 0.9 } },
                    ],
                    [
                        { ins: { '0': -0.9 } },
                        { outs: { '0': 0.1 } },
                    ],
                    [
                        { ins: { '0': -1 } },
                        { outs: { '0': 0 } },
                    ],
                    [
                        { ins: { '0': 10 } },
                        { outs: { '0': 0 } },
                    ]
                )
            }
        )
    })

    describe('implementation mtof~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['mtof~'], 'mtof~', {}),
                        nodeImplementation: nodeImplementations['mtof~'],
                    },
                    [
                        { ins: { '0': 69 } },
                        { outs: { '0': 440 } },
                    ],
                )
            }
        )
    })

    describe('implementation ftom~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should apply the expected function %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['ftom~'], 'ftom~', {}),
                        nodeImplementation: nodeImplementations['ftom~'],
                    },
                    [
                        { ins: { '0': 440 } },
                        { outs: { '0': 69 } },
                    ],
                )
            }
        )
    })
})
