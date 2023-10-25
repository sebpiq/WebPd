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

import assert from 'assert'
import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
import { createTestEngine } from '@webpd/compiler/src/test-helpers'
import { AudioSettings, CompilerTarget } from '@webpd/compiler/src/compile/types'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
    TEST_NODE_ID,
    TEST_PATCH,
} from '../test-helpers'
import { builder, nodeImplementation as nodeImplementationAdc } from './adc~'
import { nodeImplementation as nodeImplementationDac } from './dac~'
import { executeCompilation, functional } from '@webpd/compiler'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'
import { PartialNode } from '../../compile-dsp-graph/types'

const nodeImplementations = {
    'adc~': nodeImplementationAdc,
    'dac~': nodeImplementationDac,
}

describe('adc~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should convert channel indices to 0-indexed', () => {
                testNodeTranslateArgs(builder, [1, 2], {
                    channelMapping: [0, 1],
                })
            })

            it('should infer default channelMapping from incoming connections', () => {
                testNodeTranslateArgs(
                    builder,
                    [],
                    {
                        channelMapping: [0, 1, 2, 3],
                    },
                    {
                        ...TEST_PATCH,
                        connections: [
                            {
                                source: { nodeId: TEST_NODE_ID, portletId: 0 },
                                sink: { nodeId: 'someNode', portletId: 0 },
                            },
                            {
                                source: { nodeId: TEST_NODE_ID, portletId: 3 },
                                sink: { nodeId: 'someNode', portletId: 1 },
                            },
                        ],
                    }
                )
            })
        })

        describe('build', () => {
            it('should create inlets for channelMapping', () => {
                testNodeBuild(
                    builder,
                    { channelMapping: [12, 1, 6, 7] },
                    {
                        outlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
                            '2': { type: 'signal', id: '2' },
                            '3': { type: 'signal', id: '3' },
                        },
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        const channelCount = { out: 3, in: 8 }

        const createTestAdcEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            args: any
        ) => {
            const adcPartial: PartialNode = builder.build(args)

            const graph = makeGraph({
                adc: {
                    type: 'adc~',
                    args,
                    ...adcPartial,
                    sinks: functional.mapObject(
                        adcPartial.outlets,
                        (_, outletId) => [['dac', outletId]]
                    ),
                },
                dac: {
                    type: 'dac~',
                    args: {
                        channelMapping: functional.countTo(
                            args.channelMapping.length
                        ),
                    },
                    inlets: adcPartial.outlets,
                    isPullingSignal: true,
                },
            })

            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                nodeImplementations,
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code = executeCompilation(compilation)
            return await createTestEngine(compilation.target, bitDepth, code)
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should route the channels according to arguments %s',
            async ({ target, bitDepth, floatArrayType }) => {
                const engine = await createTestAdcEngine(target, bitDepth, {
                    channelMapping: [6, 3, 0],
                })
                const engineInput = functional
                    .countTo(channelCount.in)
                    .map((i) => new floatArrayType([i + 0.1]))

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.roundNestedFloats(
                        await nodeImplementationsTestHelpers.generateFrames(
                            engine,
                            1,
                            engineInput
                        )
                    ),
                    nodeImplementationsTestHelpers.roundNestedFloats([
                        [6.1, 3.1, 0.1],
                    ])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should ignore channels that are out of bounds %s',
            async ({ target, bitDepth, floatArrayType }) => {
                const engine = await createTestAdcEngine(target, bitDepth, {
                    channelMapping: [-2, 13, 2],
                })
                const engineInput = functional
                    .countTo(channelCount.in)
                    .map((i) => new floatArrayType([i + 0.1]))
                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.roundNestedFloats(
                        await nodeImplementationsTestHelpers.generateFrames(
                            engine,
                            1,
                            engineInput
                        )
                    ),
                    nodeImplementationsTestHelpers.roundNestedFloats([
                        [0, 0, 2.1],
                    ])
                )
            }
        )
    })
})
