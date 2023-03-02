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
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { createEngine } from '@webpd/compiler-js/src/test-helpers'
import { AudioSettings, CompilerTarget } from '@webpd/compiler-js/src/types'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
    TEST_NODE_ID,
    TEST_PATCH,
} from '../nodes-shared-code/test-helpers'
import { builder, nodeImplementation as nodeImplementationAdc } from './adc~'
import { nodeImplementation as nodeImplementationDac } from './dac~'
import { executeCompilation, functional } from '@webpd/compiler-js'
import { makeGraph } from '@webpd/compiler-js/src/dsp-graph/test-helpers'
import { PartialNode } from '../types'

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

        const createTestEngine = async (
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
            return await createEngine(compilation.target, bitDepth, code)
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should route the channels according to arguments %s',
            async ({ target, bitDepth, floatArrayType }) => {
                const engine = await createTestEngine(target, bitDepth, {
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
                const engine = await createTestEngine(target, bitDepth, {
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
