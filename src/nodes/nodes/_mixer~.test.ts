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

import * as testHelpers from '@webpd/compiler/src/test-helpers'
import { nodeImplementation, builder } from './_mixer~'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeBuild } from '../test-helpers'

describe('_mixer~', () => {
    describe('builder', () => {
        describe('build', () => {
            it('should create inlets for channelCount', () => {
                testNodeBuild(
                    builder,
                    {
                        channelCount: 3,
                    },
                    {
                        inlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
                            '2': { type: 'signal', id: '2' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should sum incoming signals together %s', async ({ target, bitDepth }) => {
            await testHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, '_mixer~', {
                        channelCount: 3,
                    }),
                    nodeImplementation,
                },
                [
                    { ins: { '0': 10, '1': 1, '2': 0.1 } },
                    { outs: { '0': 11.1 } },
                ],
                [
                    { ins: { '0': 20, '1': 2, '2': 0.2 } },
                    { outs: { '0': 22.2 } },
                ],
                [
                    { ins: { '0': 30, '1': 3, '2': 0.3 } },
                    { outs: { '0': 33.3 } },
                ]
            )
        })
    })
})
