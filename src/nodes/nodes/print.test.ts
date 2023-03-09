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
import { nodeImplementation, builder } from './print'

describe('print', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builder, ['bla', 123, 'hello'], {
                    prefix: 'bla 123 hello:',
                })
                testNodeTranslateArgs(builder, [], { prefix: 'print:' })
                testNodeTranslateArgs(builder, ['-n'], { prefix: '' })
                testNodeTranslateArgs(builder, ['bla'], { prefix: 'bla:' })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should log message to console %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'print', {
                            prefix: 'this is a test: ',
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[123, 'blabla'], ['bang'], [0]] } }, { outs: {} }]
                )
            }
        )
    })
})
