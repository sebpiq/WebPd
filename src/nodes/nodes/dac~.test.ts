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
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
    TEST_NODE_ID,
    TEST_PATCH,
} from '../test-helpers'
import { nodeImplementation, builder } from './dac~'
import compile, { functional, CompilerTarget } from '@webpd/compiler'
import { PartialNode } from '../../compile-dsp-graph/types'
import {
    Sequence,
    AudioSettings,
    NodeImplementations,
} from '@webpd/compiler'
import * as testHelpers from '@webpd/compiler/src/test-helpers'

describe('dac~', () => {
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
                        channelMapping: [0, 1, 2],
                    },
                    {
                        ...TEST_PATCH,
                        connections: [
                            {
                                source: { nodeId: 'someNode', portletId: 0 },
                                sink: { nodeId: TEST_NODE_ID, portletId: 0 },
                            },
                            {
                                source: { nodeId: 'someNode', portletId: 0 },
                                sink: { nodeId: TEST_NODE_ID, portletId: 2 },
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
                    { channelMapping: [0, 2, 10] },
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
        const createTestDacEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            args: any
        ) => {
            const nodeImplementations: NodeImplementations = {
                'dac~': nodeImplementation,
                counter: {
                    dsp: ({ outs }, { core }) =>
                        Sequence([
                            functional
                                .countTo(args.channelMapping.length)
                                .map(
                                    (i) =>
                                        `${outs[`${i}`]} = toFloat(${
                                            core.FRAME
                                        }) * Math.pow(10, ${i})`
                                ),
                        ]),
                },
            }

            const dacPartial: PartialNode = builder.build(args)

            const graph = testHelpers.makeGraph({
                counter: {
                    type: 'counter',
                    outlets: dacPartial.inlets,
                    sinks: Object.keys(dacPartial.inlets).reduce(
                        (sinks, inletId) => ({
                            ...sinks,
                            [inletId]: [['dac', inletId]],
                        }),
                        {}
                    ),
                },
                dac: {
                    type: 'dac~',
                    args,
                    ...dacPartial,
                },
            })

            const channelCount = { out: 4, in: 0 }
            const compileResult = compile(graph, nodeImplementations, target, {
                audio: {
                    channelCount,
                    bitDepth,
                },
            })

            if (compileResult.status !== 0) {
                throw new Error('Compilation failed')
            }

            const engine = await testHelpers.createTestEngine(
                target,
                bitDepth,
                compileResult.code
            )
            engine.initialize(engine.metadata.settings.audio.sampleRate, 1)
            return engine
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should route the channels according to arguments %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestDacEngine(target, bitDepth, {
                    channelMapping: [0, 3],
                })
                assert.deepStrictEqual(
                    testHelpers.roundNestedFloats(
                        await testHelpers.generateFrames(engine, 4)
                    ),
                    [
                        [0, 0, 0, 0],
                        [1, 0, 0, 10],
                        [2, 0, 0, 20],
                        [3, 0, 0, 30],
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should ignore channels that are out of bounds %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestDacEngine(target, bitDepth, {
                    channelMapping: [-1, 2, 10],
                })
                assert.deepStrictEqual(
                    testHelpers.roundNestedFloats(
                        await testHelpers.generateFrames(engine, 4)
                    ),
                    [
                        [0, 0, 0, 0],
                        [0, 0, 10, 0],
                        [0, 0, 20, 0],
                        [0, 0, 30, 0],
                    ]
                )
            }
        )
    })
})
