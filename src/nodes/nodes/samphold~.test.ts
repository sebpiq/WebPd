/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd 
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
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
