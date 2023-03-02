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
} from '../nodes-shared-code/test-helpers'
import { nodeImplementation, builder } from './until'

describe('until', () => {

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output N bangs %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'until', {
                            minValue: -12,
                            maxValue: 4.5,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[4]] } },
                        { outs: { '0': [['bang'], ['bang'], ['bang'], ['bang']] } },
                    ]
                )
            }
        )
    })
})
