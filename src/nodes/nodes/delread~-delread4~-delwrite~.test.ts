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
    AudioSettings,
    CompilerTarget,
    NodeImplementations,
} from '@webpd/compiler/src/types'
import {
    nodeImplementations as nodeImplementationsDelRead,
    builders as buildersDelRead,
    NodeArguments as NodeArgumentsDelread,
} from './delread~-delread4~'
import {
    nodeImplementation as nodeImplementationDelWrite,
    builder as builderDelWrite,
    NodeArguments as NodeArgumentsDelwrite,
} from './delwrite~'
import {
    nodeImplementation as nodeImplementationDac,
    builder as builderDac,
} from './dac~'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
    testParametersCombine,
} from '../test-helpers'
import { createTestEngine } from '@webpd/compiler/src/test-helpers'
import assert from 'assert'
import { executeCompilation } from '@webpd/compiler'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'

const SAMPLE_RATE = nodeImplementationsTestHelpers.ENGINE_DSP_PARAMS.sampleRate
const DELREAD_NODE_TYPES = ['delread~', 'delread4~'] as const

const DELREAD_TEST_PARAMETERS = testParametersCombine<{
    nodeType: keyof typeof buildersDelRead
}>('nodeType', DELREAD_NODE_TYPES)

describe('delread~ / delwrite~', () => {
    describe('builder [delread~]', () => {
        describe('translateArgs', () => {
            it.each(DELREAD_NODE_TYPES)('should handle args as expected', (nodeType) => {
                testNodeTranslateArgs(buildersDelRead[nodeType], [], {
                    delayName: '',
                    initDelayMsec: 0,
                })
                testNodeTranslateArgs(buildersDelRead[nodeType], ['DEL1', 1111], {
                    delayName: 'DEL1',
                    initDelayMsec: 1111,
                })
            })
        })
    })

    describe('builder [delwrite~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderDelWrite, [], {
                    delayName: '',
                    maxDurationMsec: 100,
                })
                testNodeTranslateArgs(builderDelWrite, ['DEL1', 1111], {
                    delayName: 'DEL1',
                    maxDurationMsec: 1111,
                })
            })
        })
    })

    describe('implementation messages delread~ / delread4~ / delwrite~', () => {
        const createTestDelReadWriteEngine = async (
            target: CompilerTarget,
            nodeType: 'delread~' | 'delread4~',
            bitDepth: AudioSettings['bitDepth'],
            delwriteArgs: NodeArgumentsDelwrite,
            delreadArgs: NodeArgumentsDelread
        ) => {
            const nodeImplementations: NodeImplementations = {
                'delread~': nodeImplementationsDelRead[nodeType],
                'delwrite~': nodeImplementationDelWrite,
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
                    sinks: { '0': [['delayW', '0']] },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                delayW: {
                    type: 'delwrite~',
                    ...builderDelWrite.build(delwriteArgs),
                    args: delwriteArgs as any,
                },
                delayR: {
                    type: 'delread~',
                    ...buildersDelRead[nodeType].build(delreadArgs),
                    args: delreadArgs as any,
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
                    delayR: ['0_message'],
                    delayW: ['0_message']
                },
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code =
                executeCompilation(compilation)

            return await createTestEngine(compilation.target, bitDepth, code)
        }

        it.each(DELREAD_TEST_PARAMETERS)(
            'should read with the configured delay %s',
            async ({ target, bitDepth, nodeType }) => {
                const engine = await createTestDelReadWriteEngine(
                    target,
                    nodeType,
                    bitDepth,
                    {
                        maxDurationMsec: 10,
                        delayName: 'DEL1',
                    },
                    {
                        initDelayMsec: 0,
                        delayName: 'DEL1',
                    }
                )

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [0],
                    [1],
                    [2],
                    [3],
                ])

                // Change the delay 2 samples
                engine.inletCallers['delayR']['0_message']([(2 * 1000) / SAMPLE_RATE])

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [2],
                    [3],
                    [4],
                    [5],
                ])
            }
        )

        it.each(DELREAD_TEST_PARAMETERS)(
            'should clear delay line when sending clear %s',
            async ({ target, bitDepth, nodeType }) => {
                const engine = await createTestDelReadWriteEngine(
                    target,
                    nodeType,
                    bitDepth,
                    {
                        maxDurationMsec: 10,
                        delayName: 'DEL1',
                    },
                    {
                        initDelayMsec: 0,
                        delayName: 'DEL1',
                    }
                )

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [0],
                    [1],
                    [2],
                    [3],
                ])

                // Change the delay 2 samples
                engine.inletCallers['delayR']['0_message']([(3 * 1000) / SAMPLE_RATE])
                engine.inletCallers['delayW']['0_message'](['clear'])

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [0],
                    [0],
                    [0],
                    [4],
                ])
            }
        )
    })

    describe('implementation signal delread4~ / delwrite~', () => {
        const createTestDelReadWriteEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            delwriteArgs: NodeArgumentsDelwrite,
            delreadArgs: NodeArgumentsDelread
        ) => {
            const nodeImplementations: NodeImplementations = {
                'delread4~': nodeImplementationsDelRead['delread4~'],
                'delwrite~': nodeImplementationDelWrite,
                'dac~': nodeImplementationDac,
                counter: {
                    loop: ({ globs, outs }) =>
                        `${outs.$0} = toFloat(${globs.frame})`,
                },
                delayControl: {
                    declare: ({ state, macros: { Var } }) => `
                        let ${Var(state.value, 'Float')} = 0
                    `,
                    messages: ({ state, globs }) => ({
                        '0': `
                        ${state.value} = msg_readFloatToken(${globs.m}, 0)
                        return
                        `
                    }),
                    loop: ({ state, outs }) =>
                        `${outs.$0} = ${state.value}`,
                    stateVariables: {value: 1},
                },
            }

            const dacArgs = { channelMapping: [0] }

            const graph = makeGraph({
                counter: {
                    type: 'counter',
                    sinks: { '0': [['delayW', '0']] },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                delayW: {
                    type: 'delwrite~',
                    ...builderDelWrite.build(delwriteArgs),
                    args: delwriteArgs as any,
                },
                delayControl: {
                    type: 'delayControl',
                    sinks: { '0': [['delayR', '0']] },
                    inlets: {
                        '0': { id: '0', type: 'message' },
                    },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                delayR: {
                    type: 'delread4~',
                    ...buildersDelRead['delread4~'].build(delreadArgs),
                    args: delreadArgs as any,
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
                    delayControl: ['0'],
                },
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code =
                executeCompilation(compilation)

            return await createTestEngine(compilation.target, bitDepth, code)
        }

        it.only.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read with the configured delay %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestDelReadWriteEngine(
                    target,
                    bitDepth,
                    {
                        maxDurationMsec: 10,
                        delayName: 'DEL1',
                    },
                    {
                        initDelayMsec: 0,
                        delayName: 'DEL1',
                    }
                )

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [0],
                    [1],
                    [2],
                    [3],
                ])

                // Change the delay 2 samples
                engine.inletCallers['delayControl']['0']([(2 * 1000) / SAMPLE_RATE])

                assert.deepStrictEqual(nodeImplementationsTestHelpers.generateFrames(engine, 4), [
                    [2],
                    [3],
                    [4],
                    [5],
                ])
            }
        )
    })
})
