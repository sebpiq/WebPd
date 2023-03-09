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
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'
import { nodeImplementation, builder } from './loadbang'

describe('loadbang', () => {
    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should output a bang on creation %s', async ({ target, bitDepth }) => {
            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'loadbang', {}),
                    nodeImplementation,
                },
                [{ ins: {} }, { outs: { '0': [['bang']] } }],
                [{ ins: {} }, { outs: { '0': [] } }],
                [{ ins: {} }, { outs: { '0': [] } }]
            )
        })
    })
})
