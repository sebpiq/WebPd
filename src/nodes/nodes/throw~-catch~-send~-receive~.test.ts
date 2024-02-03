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
} from '@webpd/compiler/src/compile/types'
import {
    nodeImplementations as nodeImplementationsThrowCatchSendReceive,
    builders,
    NodeArguments,
} from './throw~-catch~-send~-receive~'
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
import compile from '@webpd/compiler'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'
import { ast } from '@webpd/compiler'

describe('throw~ / catch~', () => {
    describe('builder [throw~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builders['throw~'], [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [catch~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builders['catch~'], [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [send~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builders['send~'], [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [receive~]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builders['receive~'], [], {
                    busName: '',
                })
            })
        })
    })

    describe('implementation throw~/catch~', () => {
        const createTestThrowCatchEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            throwArgs: NodeArguments,
            catchArgs: NodeArguments
        ) => {
            const nodeImplementations: NodeImplementations = {
                ...nodeImplementationsThrowCatchSendReceive,
                'dac~': nodeImplementationDac,
                counter: {
                    dsp: ({ globs, outs }) =>
                        ast`${outs.$0} = toFloat(${globs.frame})`,
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
                    ...builders['throw~'].build(throwArgs),
                    args: throwArgs as any,
                },
                throw2: {
                    type: 'throw~',
                    ...builders['throw~'].build(throwArgs),
                    args: throwArgs as any,
                },
                catch: {
                    type: 'catch~',
                    ...builders['catch~'].build(catchArgs),
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

            const compileResult = compile(graph, nodeImplementations, target, {
                io: {
                    messageReceivers: {
                        throw2: { portletIds: ['0_message'] },
                    },
                },
                audio: {
                    channelCount,
                    bitDepth,
                },
            })

            if (compileResult.status !== 0) {
                throw new Error('Compilation failed')
            }

            return await createTestEngine(target, bitDepth, compileResult.code)
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read the mix of all throw inputs %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestThrowCatchEngine(
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
                const engine = await createTestThrowCatchEngine(
                    target,
                    bitDepth,
                    {
                        busName: 'BUS1',
                    },
                    {
                        busName: 'BUS1',
                    }
                )

                engine.io.messageReceivers.throw2['0_message'](['set', 'unknown_bus'])

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.generateFrames(engine, 4),
                    [[0], [1], [2], [3]]
                )
            }
        )
    })

    describe('implementation send~/receive~', () => {
        const createSndRcvTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            sendArgs: NodeArguments,
            receiveArgs: NodeArguments
        ) => {
            const nodeImplementations: NodeImplementations = {
                'send~': nodeImplementationsThrowCatchSendReceive['send~'],
                'receive~':
                    nodeImplementationsThrowCatchSendReceive['receive~'],
                'dac~': nodeImplementationDac,
                counter: {
                    dsp: ({ globs, outs }) =>
                        ast`${outs.$0} = toFloat(${globs.frame})`,
                },
            }

            const dacArgs = { channelMapping: [0, 1] }

            const graph = makeGraph({
                counter: {
                    type: 'counter',
                    sinks: {
                        '0': [['send', '0']],
                    },
                    outlets: {
                        '0': { id: '0', type: 'signal' },
                    },
                },
                send: {
                    type: 'send~',
                    ...builders['send~'].build(sendArgs),
                    args: sendArgs as any,
                },
                receive1: {
                    type: 'receive~',
                    ...builders['receive~'].build(receiveArgs),
                    args: receiveArgs as any,
                    sinks: { '0': [['dac', '0']] },
                },
                receive2: {
                    type: 'receive~',
                    ...builders['receive~'].build(receiveArgs),
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

            const compileResult = compile(graph, nodeImplementations, target, {
                io: {
                    messageReceivers: {
                        receive2: { portletIds: ['0'] },
                    },
                },
                audio: {
                    channelCount,
                    bitDepth,
                },
            })

            if (compileResult.status !== 0) {
                throw new Error('Compilation failed')
            }

            return await createTestEngine(target, bitDepth, compileResult.code)
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
                    [
                        [0, 0],
                        [1, 1],
                        [2, 2],
                        [3, 3],
                    ]
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

                engine.io.messageReceivers.receive2['0'](['set', 'unknown_bus'])

                assert.deepStrictEqual(
                    nodeImplementationsTestHelpers.generateFrames(engine, 4),
                    [
                        [0, 0],
                        [1, 0],
                        [2, 0],
                        [3, 0],
                    ]
                )
            }
        )
    })
})
