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
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './moses'

describe('moses', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    threshold: 0,
                })
                testNodeTranslateArgs(builder, [13], {
                    threshold: 13,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output values on right if >= threshold %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: -12,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[-12], [0], [10.1]] } },
                        { outs: { '0': [], '1': [[-12], [0], [10.1]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output values on left if < threshold %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: -12,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[-12.1], [-19]] } },
                        { outs: { '0': [[-12.1], [-19]], '1': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change the threshold when sending on inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'moses', {
                            threshold: 9,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[8]] } },
                        { outs: { '0': [[8]], '1': [] } },
                    ],
                    [{ ins: { '1': [[7]] } }, { outs: { '0': [], '1': [] } }],
                    [{ ins: { '0': [[8]] } }, { outs: { '0': [], '1': [[8]] } }]
                )
            }
        )
    })
})
