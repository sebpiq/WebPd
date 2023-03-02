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
import { nodeImplementation, builder } from './snapshot~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../nodes-shared-code/test-helpers'

describe('snapshot~', () => {

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send input snapshot on bang %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'snapshot~', {}),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 12.5 }}, { outs: { '0': [] } }],
                    [{ ins: { '0_message': [['bang']] } }, { outs: { '0': [[12.5]] } }],
                    [{ ins: { '0': 15.5 }}, { outs: { '0': [] } }],
                )
            }
        )
    })
})
