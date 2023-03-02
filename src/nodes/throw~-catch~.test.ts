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

import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import {
    AudioSettings,
    CompilerTarget,
    NodeImplementations,
} from '@webpd/compiler-js/src/types'
import {
    nodeImplementation as nodeImplementationThrow,
    builder as builderThrow,
    NodeArguments as NodeArgumentsThrow,
} from './throw~'
import {
    nodeImplementation as nodeImplementationCatch,
    builder as builderCatch,
    NodeArguments as NodeArgumentsCatch,
} from './catch~'
import {
    nodeImplementation as nodeImplementationDac,
    builder as builderDac,
} from './dac~'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../nodes-shared-code/test-helpers'
import { createEngine } from '@webpd/compiler-js/src/test-helpers'
import assert from 'assert'
import { executeCompilation } from '@webpd/compiler-js'
import { makeGraph } from '@webpd/compiler-js/src/dsp-graph/test-helpers'

describe('throw~ / catch~', () => {
    describe('builder [throw~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderThrow, [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [catch~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderCatch, [], {
                    busName: '',
                })
            })
        })
    })

    describe('implementation', () => {
        const createTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            throwArgs: NodeArgumentsThrow,
            catchArgs: NodeArgumentsCatch
        ) => {
            const nodeImplementations: NodeImplementations = {
                'throw~': nodeImplementationThrow,
                'catch~': nodeImplementationCatch,
                'dac~': nodeImplementationDac,
                counter: {
                    loop: ({ globs, outs }) =>
                        `${outs.$0} = toFloat(${globs.frame})`,
                },
            }

            const dacArgs = { channelMapping: [0] }

            const graph = makeGraph({
                counter: {
                    type: 'counter',
                    sinks: {
                        '0': [
                            ['throw1', '0'],
                            ['throw2', '0'],
                        ],
                    },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                throw1: {
                    type: 'throw~',
                    ...builderThrow.build(throwArgs),
                    args: throwArgs as any,
                },
                throw2: {
                    type: 'throw~',
                    ...builderThrow.build(throwArgs),
                    args: throwArgs as any,
                },
                catch: {
                    type: 'catch~',
                    ...builderCatch.build(catchArgs),
                    args: catchArgs as any,
                    sinks: { '0': [['dac', '0']] },
                },
                dac: {
                    type: 'dac~',
                    args: dacArgs,
                    ...builderDac.build(dacArgs),
                },
            })

            const channelCount = { out: 1, in: 0 }
            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                nodeImplementations,
                inletCallerSpecs: {
                    throw2: ['0_message'],
                },
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code = executeCompilation(compilation)

            return await createEngine(compilation.target, bitDepth, code)
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read the mix of all throw inputs %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                    {
                        busName: 'BUS1',
                    },
                    {
                        busName: 'BUS1',
                    }
                )

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.generateFrames(engine, 4),
                    [[0], [2], [4], [6]]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the throw address %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                    {
                        busName: 'BUS1',
                    },
                    {
                        busName: 'BUS1',
                    }
                )

                engine.inletCallers.throw2['0_message'](['set', 'unknown_bus'])

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.generateFrames(engine, 4),
                    [[0], [1], [2], [3]]
                )
            }
        )
    })
})
