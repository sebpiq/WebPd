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
import { nodeImplementation, builder } from './unpack'

describe('unpack', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    typeArguments: ['float', 'float']
                })
                testNodeTranslateArgs(builder, ['f', 12, 'float', 'symbol'], {
                    typeArguments: ['float', 'float', 'float', 'symbol']
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should unpacked values %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'unpack', {
                            typeArguments: ['float', 'symbol']
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [
                            [123, 'hello'],
                            [888, 'poi'],
                        ] } },
                        { outs: { '0': [[123], [888]], '1': [['hello'], ['poi']] } },
                    ]
                )
            }
        )
    })
})
