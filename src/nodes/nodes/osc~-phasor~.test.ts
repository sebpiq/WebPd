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
import { nodeImplementations, builders } from './osc~-phasor~'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeTranslateArgs } from '../test-helpers'

describe('osc~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builders['osc~'], [], { frequency: 0 })
                testNodeTranslateArgs(builders['phasor~'], [110], { frequency: 110 })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should oscillate at the given frequency %s', async ({ target, bitDepth }) => {
            const { sampleRate } =
                nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS
            const frequency1 = 100
            const frequency2 = 200
            const frequency3 = 50
            const J = (2 * Math.PI) / sampleRate
            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builders['osc~'], 'osc~', {
                        frequency: 0,
                    }),
                    nodeImplementation: nodeImplementations['osc~'],
                },
                [
                    { ins: { '0': frequency1 } },
                    { outs: { '0': Math.cos(0) } },
                ],
                [
                    { ins: { '0': frequency1 } },
                    { outs: { '0': Math.cos(100 * J) } },
                ],
                [
                    { ins: { '0': frequency2 } },
                    { outs: { '0': Math.cos(200 * J) } },
                ],
                [
                    { ins: { '0': frequency2 } },
                    { outs: { '0': Math.cos(400 * J) } },
                ],
                [
                    { ins: { '0': frequency3 } },
                    { outs: { '0': Math.cos(600 * J) } },
                ],
                [
                    { ins: { '0': frequency3 } },
                    { outs: { '0': Math.cos(650 * J) } },
                ]
            )
        })

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should reset phase with second inlet %s',
            async ({ target, bitDepth }) => {
                const { sampleRate } =
                    nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS
                const frequency = 100
                const J = (2 * Math.PI * frequency) / sampleRate

                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['osc~'], 'osc~', { frequency }),
                        nodeImplementation: nodeImplementations['osc~'],
                    },
                    [
                        { ins: { '0': frequency, '1': [] } },
                        { outs: { '0': Math.cos(0) } },
                    ],
                    [
                        { ins: { '0': frequency, '1': [] } },
                        { outs: { '0': Math.cos(1 * J) } },
                    ],
                    [
                        { ins: { '0': frequency, '1': [[0]] } },
                        { outs: { '0': 1.0 } },
                    ],
                    [
                        { ins: { '0': frequency, '1': [[0.25]] } },
                        { outs: { '0': 0.0 } },
                    ],
                    [
                        { ins: { '0': frequency, '1': [[-2.5]] } },
                        { outs: { '0': -1.0 } },
                    ]
                )
            }
        )
    })

    describe('phasor~ implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should have the expected signal output %s', async ({ target, bitDepth }) => {
            const { sampleRate } =
                nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS
            const frequency1 = 100
            const frequency2 = 300
            const J = frequency1 / sampleRate

            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builders['phasor~'], 'phasor~', {
                        frequency: frequency1,
                    }),
                    nodeImplementation: nodeImplementations['phasor~'],
                },
                [{ ins: { '0': frequency1 } }, { outs: { '0': 0 } }],
                [
                    { ins: { '0': frequency1 } },
                    { outs: { '0': 1 * J } },
                ],
                [
                    { ins: { '0': frequency2 } },
                    { outs: { '0': 2 * J } },
                ],
                [
                    { ins: { '0': frequency2 } },
                    { outs: { '0': 5 * J } },
                ],
                [
                    { ins: { '0': frequency2 } },
                    { outs: { '0': 8 * J } },
                ]
            )
        })
    })
})
