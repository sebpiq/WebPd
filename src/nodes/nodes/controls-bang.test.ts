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
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder, NodeArguments } from './controls-bang'
import { createEngine } from '@webpd/compiler-js/src/test-helpers'
import {
    nodeImplementation as nodeImplementationSend,
    builder as builderSend,
} from './send'
import {
    nodeImplementation as nodeImplementationReceive,
    builder as builderReceive,
} from './receive'
import {
    CompilerTarget,
    AudioSettings,
    NodeImplementations,
    Message,
} from '@webpd/compiler-js/src/types'
import assert from 'assert'
import { makeGraph } from '@webpd/compiler-js/src/dsp-graph/test-helpers'

describe('controls-bang', () => {
    describe('builders', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [0], {
                    outputOnLoad: false,
                    sendBusName: 'empty',
                    receiveBusName: 'empty',
                })
                testNodeTranslateArgs(builder, [1, 'RCV', 'SND'], {
                    outputOnLoad: true,
                    sendBusName: 'SND',
                    receiveBusName: 'RCV',
                })
            })
        })

        describe('build', () => {
            it('should not be a message source if not outputOnLoad', () => {
                testNodeBuild(
                    builder,
                    {
                        outputOnLoad: false,
                        sendBusName: 'empty',
                        receiveBusName: 'empty',
                    },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                        },
                    }
                )
            })
            it('should be a message source if outputOnLoad', () => {
                testNodeBuild(
                    builder,
                    {
                        outputOnLoad: true,
                        sendBusName: 'empty',
                        receiveBusName: 'empty',
                    },
                    {
                        inlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        outlets: {
                            '0': { type: 'message', id: '0' },
                        },
                        isPushingMessages: true,
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should handle messages as expected %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'bng', {
                            outputOnLoad: false,
                            sendBusName: 'empty',
                            receiveBusName: 'empty',
                        }),
                        nodeImplementation: nodeImplementation,
                    },
                    [
                        { ins: { '0': [[2.9], ['bla'], ['bang']] } },
                        { outs: { '0': [['bang'], ['bang'], ['bang']] } },
                    ],
                    [{}, { outs: { '0': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send message on load if init %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'bng', {
                            outputOnLoad: true,
                            sendBusName: 'empty',
                            receiveBusName: 'empty',
                        }),
                        nodeImplementation: nodeImplementation,
                    },
                    [{}, { outs: { '0': [['bang']] } }],
                    [{}, { outs: { '0': [] } }]
                )
            }
        )
    })

    describe('message send / receive', () => {
        const BANG_ARGS_DEFAULT = {
            outputOnLoad: false,
        }

        const createTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
            bangArgs: NodeArguments
        ) => {
            const _nodeImplementations: NodeImplementations = {
                bang: nodeImplementation,
                send: nodeImplementationSend,
                receive: nodeImplementationReceive,
            }

            const graph = makeGraph({
                bang: {
                    type: 'bang',
                    ...builder.build(bangArgs),
                    args: bangArgs,
                },
                send: {
                    type: 'send',
                    ...builderSend.build({ busName: 'BUS_TO_BANG' }),
                    args: { busName: 'BUS_TO_BANG' },
                },
                receive: {
                    type: 'receive',
                    ...builderReceive.build({ busName: 'BUS_FROM_BANG' }),
                    args: { busName: 'BUS_FROM_BANG' },
                },
            })

            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                audioSettings: {
                    bitDepth,
                    channelCount: { in: 0, out: 0 }
                },
                nodeImplementations: _nodeImplementations,
                inletCallerSpecs: {
                    send: ['0'],
                    bang: ['0'],
                },
                outletListenerSpecs: {
                    receive: ['0'],
                    bang: ['0'],
                },
            })

            const code =
                nodeImplementationsTestHelpers.executeCompilation(compilation)
            const engine = await createEngine(
                compilation.target,
                bitDepth,
                code
            )
            engine.configure(44100, 1)
            return engine
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send / receive messages to specified buses %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(target, bitDepth, {
                    ...BANG_ARGS_DEFAULT,
                    receiveBusName: 'BUS_TO_BANG',
                    sendBusName: 'BUS_FROM_BANG',
                })

                const received: Array<Message> = []
                const receivedControl: Array<Message> = []

                engine.outletListeners.receive['0'].onMessage = (msg) =>
                    received.push(msg)
                engine.outletListeners.bang['0'].onMessage = (msg) =>
                    receivedControl.push(msg)

                engine.inletCallers.send['0']([666])
                assert.deepStrictEqual(received, [['bang']])
                assert.deepStrictEqual(receivedControl, [['bang']])
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set send / receive buses with send / receive message to bang %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(target, bitDepth, {
                    ...BANG_ARGS_DEFAULT,
                    receiveBusName: 'empty',
                    sendBusName: 'empty',
                })

                const received: Array<Message> = []
                const receivedControl: Array<Message> = []

                engine.outletListeners.receive['0'].onMessage = (msg) =>
                    received.push(msg)
                engine.outletListeners.bang['0'].onMessage = (msg) =>
                    receivedControl.push(msg)

                engine.inletCallers.send['0']([666])
                assert.deepStrictEqual(received, [])
                assert.deepStrictEqual(receivedControl, [])

                engine.inletCallers.bang['0'](['receive', 'BUS_TO_BANG'])
                engine.inletCallers.send['0']([888])
                assert.deepStrictEqual(received, [])
                assert.deepStrictEqual(receivedControl, [['bang']])

                engine.inletCallers.bang['0'](['send', 'BUS_FROM_BANG'])
                engine.inletCallers.bang['0']([999])
                assert.deepStrictEqual(received, [['bang']])
                assert.deepStrictEqual(receivedControl, [['bang'], ['bang']])
            }
        )
    })
})
