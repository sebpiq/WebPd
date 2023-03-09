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
import { nodeImplementations, builders } from './float-int'

describe('float / int', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have default value 0', () => {
                testNodeTranslateArgs(builders['float'], [1], { value: 1 })
                testNodeTranslateArgs(builders['float'], [], { value: 0 })
            })
        })
    })

    describe('implementation', () => {
        describe('float', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should output stored value on bang %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['float'], 'float', {
                                value: 2.9,
                            }),
                            nodeImplementation: nodeImplementations['float'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[2.9]] } },
                        ],
                        [{ ins: { '1': [[666]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[666]] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should store and output value on float %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['float'], 'float', {
                                value: -11,
                            }),
                            nodeImplementation: nodeImplementations['float'],
                        },
                        [
                            { ins: { '0': [[-9.99]] } },
                            { outs: { '0': [[-9.99]] } },
                        ],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[-9.99]] } },
                        ]
                    )
                }
            )
        })

        describe('int', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should round stored value correctly %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['int'], 'int', {
                                value: 2.9,
                            }),
                            nodeImplementation: nodeImplementations['int'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[2]] } },
                        ],
                        [{ ins: { '1': [[-6.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[-6]] } },
                        ]
                    )
                }
            )
        })
    })
})
