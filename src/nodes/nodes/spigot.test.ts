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

import { testHelpers } from '@webpd/compiler'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './spigot'

describe('spigot', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], { isClosed: true })
                testNodeTranslateArgs(builder, [10], { isClosed: false })
                testNodeTranslateArgs(builder, [0], { isClosed: true })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should bypass when open %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: false }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[13, 'blabla'], [0]] } },
                        { outs: { '0': [[13, 'blabla'], [0]] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should block when closed %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: true }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[13, 'blabla'], [0]] } },
                        { outs: { '0': [] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should open / close with inlet 1 %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'spigot', { isClosed: false }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '1': [[0]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '1': [[1]] } },
                        { outs: { '0': [] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bang']] } },
                    ],
                )
            }
        )
    })
})
