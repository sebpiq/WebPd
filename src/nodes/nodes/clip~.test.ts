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
import { nodeImplementation, builder } from './clip~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('clip~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    minValue: 0,
                    maxValue: 0,
                })
                testNodeTranslateArgs(builder, [-10, 11], {
                    minValue: -10,
                    maxValue: 11,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should clip signal to [min, max] %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip~', {
                            minValue: -1.5,
                            maxValue: 2.5,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': 1.2 } }, { outs: { '0': 1.2 } }],
                    [{ ins: { '0': -1.5 } }, { outs: { '0': -1.5 } }],
                    [{ ins: { '0': -2 } }, { outs: { '0': -1.5 } }],
                    [{ ins: { '0': 2.6 } }, { outs: { '0': 2.5 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change min max on message inlets %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'clip~', {
                            minValue: -1.5,
                            maxValue: 2.5,
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': 1.1, '1': [[-0.5]], '2': [[0.5]] } },
                        { outs: { '0': 0.5 } },
                    ],
                    [{ ins: { '0': -1.5 } }, { outs: { '0': -0.5 } }]
                )
            }
        )
    })
})
