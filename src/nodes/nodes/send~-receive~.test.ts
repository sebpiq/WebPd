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
    nodeImplementation as nodeImplementationSend,
    builder as builderSend,
    NodeArguments as NodeArgumentsSend,
} from './send~'
import {
    nodeImplementation as nodeImplementationReceive,
    builder as builderReceive,
    NodeArguments as NodeArgumentsReceive,
} from './receive~'
import {
    nodeImplementation as nodeImplementationDac,
    builder as builderDac,
} from './dac~'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { createTestEngine } from '@webpd/compiler/src/test-helpers'
import assert from 'assert'
import { executeCompilation } from '@webpd/compiler'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'

describe('send~ / receive~', () => {
    describe('builder [send~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderSend, [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [receive~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderReceive, [], {
                    busName: '',
                })
            })
        })
    })

    describe('implementation', () => {
        const createSndRcvTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            sendArgs: NodeArgumentsSend,
            receiveArgs: NodeArgumentsReceive
        ) => {
            const nodeImplementations: NodeImplementations = {
                'send~': nodeImplementationSend,
                'receive~': nodeImplementationReceive,
                'dac~': nodeImplementationDac,
                counter: {
                    loop: ({ globs, outs }) =>
                        `${outs.$0} = toFloat(${globs.frame})`,
                },
            }

            const dacArgs = { channelMapping: [0, 1] }

            const graph = makeGraph({
                counter: {
                    type: 'counter',
                    sinks: {
                        '0': [
                            ['send', '0'],
                        ],
                    },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                send: {
                    type: 'send~',
                    ...builderSend.build(sendArgs),
                    args: sendArgs as any,
                },
                receive1: {
                    type: 'receive~',
                    ...builderReceive.build(receiveArgs),
                    args: receiveArgs as any,
                    sinks: { '0': [['dac', '0']] },
                },
                receive2: {
                    type: 'receive~',
                    ...builderReceive.build(receiveArgs),
                    args: receiveArgs as any,
                    sinks: { '0': [['dac', '1']] },
                },
                dac: {
                    type: 'dac~',
                    args: dacArgs,
                    ...builderDac.build(dacArgs),
                },
            })

            const channelCount = { out: 2, in: 0 }
            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                nodeImplementations,
                inletCallerSpecs: {
                    receive2: ['0'],
                },
                audioSettings: {
                    channelCount,
                    bitDepth,
                },
            })

            const code = executeCompilation(compilation)

            return await createTestEngine(compilation.target, bitDepth, code)
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should all receive the sent signal %s',
            async ({ target, bitDepth }) => {
                const engine = await createSndRcvTestEngine(
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
                    [[0, 0], [1, 1], [2, 2], [3, 3]]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the send address %s',
            async ({ target, bitDepth }) => {
                const engine = await createSndRcvTestEngine(
                    target,
                    bitDepth,
                    {
                        busName: 'BUS1',
                    },
                    {
                        busName: 'BUS1',
                    }
                )

                engine.inletCallers.receive2['0'](['set', 'unknown_bus'])

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.generateFrames(engine, 4),
                    [[0, 0], [1, 0], [2, 0], [3, 0]]
                )
            }
        )
    })
})
