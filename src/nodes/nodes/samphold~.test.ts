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
import { nodeImplementation, builder } from './samphold~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../test-helpers'

describe('samphold~', () => {
    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should update signal when control value decreases %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'samphold~', {}),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2, '1': 10 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 2.2, '1': 11 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 3.2, '1': 10 } }, { outs: { '0': 3.2 } }],
                    [{ ins: { '0': 4.2, '1': 9 } }, { outs: { '0': 4.2 } }],
                    [{ ins: { '0': 5.2, '1': 9 } }, { outs: { '0': 4.2 } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set signal on set message %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'samphold~', {}),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2, '1': 10 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 2.2, '0_message': [['set', 666]], '1': 11 } }, { outs: { '0': 666 } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should reset control on reset message with a value %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'samphold~', {}),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2, '1': 10 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 2.2, '0_message': [['reset', 12]], '1': 11 } }, { outs: { '0': 2.2 } }],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should reset control on reset message without value %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'samphold~', {}),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2, '1': 10 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 2.2, '0_message': [['reset']], '1': 11 } }, { outs: { '0': 2.2 } }],
                )
            }
        )
    })
})
