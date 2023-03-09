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

import assert from 'assert'
import {
    AudioSettings,
    CompilerTarget,
    NodeImplementations,
} from '@webpd/compiler-js/src/types'
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { createEngine } from '@webpd/compiler-js/src/test-helpers'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
    TEST_NODE_ID,
    TEST_PATCH,
} from '../test-helpers'
import { nodeImplementation, builder } from './dac~'
import { executeCompilation, functional } from '@webpd/compiler-js'
import { makeGraph } from '@webpd/compiler-js/src/dsp-graph/test-helpers'
import { PartialNode } from '../../compile-dsp-graph/types'

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
        const createTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            args: any
        ) => {
            const nodeImplementations: NodeImplementations = {
                'dac~': nodeImplementation,
                counter: {
                    loop: ({ globs, outs }) => functional.renderCode`
                        ${functional
                            .countTo(args.channelMapping.length)
                            .map(
                                (i) =>
                                    `${outs[`${i}`]} = toFloat(${globs.frame}) * Math.pow(10, ${i})`
                            )}
                    `,
                },
            }

            const dacPartial: PartialNode = builder.build(args)

            const graph = makeGraph({
                counter: {
                    type: 'counter',
                    outlets: dacPartial.inlets,
                    sinks: functional.mapObject(
                        dacPartial.inlets,
                        (_, inletId) => [['dac', inletId]]
                    ),
                },
                dac: {
                    type: 'dac~',
                    args,
                    ...dacPartial,
                },
            })

            const channelCount = { out: 4, in: 0 }
            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                nodeImplementations,
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code =
                executeCompilation(compilation)

            return await createEngine(
                compilation.target,
                bitDepth,
                code
            )
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should route the channels according to arguments %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(target, bitDepth, {
                        channelMapping: [0, 3],
                    })
                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.roundNestedFloats(
                        await nodeImplementationsTestHelpers.generateFrames(
                            engine,
                            4,
                        )
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
                const engine = await createTestEngine(target, bitDepth, {
                    channelMapping: [-1, 2, 10],
                })
                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.roundNestedFloats(
                        await nodeImplementationsTestHelpers.generateFrames(
                            engine,
                            4,
                        )
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
