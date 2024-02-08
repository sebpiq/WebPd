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
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeBuild,
    testNodeTranslateArgs,
    testParametersCombine,
} from '../test-helpers'
import { nodeImplementations, builders, NodeArguments } from './controls-float'
import { createTestEngine } from '@webpd/compiler/src/test-helpers'
import {
    nodeImplementations as nodeImplementationsSendReceive,
    builders as buildersSendReceive,
} from './send-receive'
import {
    CompilerTarget,
    AudioSettings,
    NodeImplementations,
} from '@webpd/compiler/src/compile/types'
import { Message } from '@webpd/compiler/src/run/types'
import assert from 'assert'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'
import compile from '@webpd/compiler'

const NODE_TYPES_NUMBERS = ['hsl', 'hradio', 'vsl', 'vradio'] as const
const NODE_TYPES_ALL = [...NODE_TYPES_NUMBERS, 'nbx', 'tgl'] as const

const CONTROLS_TEST_PARAMETERS_NUMBERS = testParametersCombine<{
    nodeType: keyof typeof builders
}>('nodeType', NODE_TYPES_NUMBERS)
const CONTROLS_TEST_PARAMETERS_ALL = testParametersCombine<{
    nodeType: keyof typeof builders
}>('nodeType', NODE_TYPES_ALL)

describe('controls-float', () => {
    describe('builders', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                // builderWithInit
                testNodeTranslateArgs(builders['nbx'], [-11, 11, 0, 22], {
                    minValue: -11,
                    maxValue: 11,
                    initValue: 0,
                    outputOnLoad: false,
                    receiveBusName: 'empty',
                    sendBusName: 'empty',
                })
                testNodeTranslateArgs(
                    builders['nbx'],
                    [-11, 11, 1, 22, 'RCV', 'SND'],
                    {
                        minValue: -11,
                        maxValue: 11,
                        initValue: 22,
                        outputOnLoad: true,
                        receiveBusName: 'RCV',
                        sendBusName: 'SND',
                    }
                )
                // builderWithoutMin
                testNodeTranslateArgs(builders['tgl'], [11, 0, 22], {
                    minValue: 0,
                    maxValue: 11,
                    initValue: 0,
                    outputOnLoad: false,
                    receiveBusName: 'empty',
                    sendBusName: 'empty',
                })
                testNodeTranslateArgs(
                    builders['tgl'],
                    [11, 1, 22, 'RCV', 'SND'],
                    {
                        minValue: 0,
                        maxValue: 11,
                        initValue: 22,
                        outputOnLoad: true,
                        receiveBusName: 'RCV',
                        sendBusName: 'SND',
                    }
                )
            })
        })

        describe('build', () => {
            it('should not be a message source if not outputOnLoad', () => {
                testNodeBuild(
                    builders['nbx'],
                    {
                        minValue: 0,
                        maxValue: 1,
                        initValue: 0,
                        outputOnLoad: false,
                        receiveBusName: 'empty',
                        sendBusName: 'empty',
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
                    builders['nbx'],
                    {
                        minValue: 0,
                        maxValue: 1,
                        initValue: 0,
                        outputOnLoad: true,
                        receiveBusName: 'empty',
                        sendBusName: 'empty',
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
        describe('all', () => {
            it.each(CONTROLS_TEST_PARAMETERS_ALL)(
                'should send message on load if init %s',
                async ({ target, bitDepth, nodeType }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders[nodeType], nodeType, {
                                initValue: 42,
                                maxValue: 127,
                                minValue: 0,
                                outputOnLoad: true,
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations[nodeType],
                        },
                        [{}, { outs: { '0': [[42]] } }],
                        [{}, { outs: { '0': [] } }]
                    )
                }
            )
        })

        describe('message send / receive', () => {
            const CONTROL_ARGS_DEFAULT = {
                initValue: 42,
                maxValue: 1000,
                minValue: 0,
                outputOnLoad: false,
            }

            const createTestSndRcvEngine = async (
                target: CompilerTarget,
                bitDepth: AudioSettings['bitDepth'],
                controlType: keyof typeof builders,
                controlArgs: NodeArguments
            ) => {
                const _nodeImplementations: NodeImplementations = {
                    ...nodeImplementations,
                    ...nodeImplementationsSendReceive,
                }

                const graph = makeGraph({
                    control: {
                        type: controlType,
                        ...builders[controlType].build(controlArgs),
                        args: controlArgs,
                    },
                    send: {
                        type: 'send',
                        ...buildersSendReceive['send'].build({
                            busName: 'BUS_TO_CTRL',
                        }),
                        args: { busName: 'BUS_TO_CTRL' },
                    },
                    receive: {
                        type: 'receive',
                        ...buildersSendReceive['receive'].build({
                            busName: 'BUS_FROM_CTRL',
                        }),
                        args: { busName: 'BUS_FROM_CTRL' },
                    },
                })

                const compileResult = compile(
                    graph,
                    _nodeImplementations,
                    target,
                    {
                        audio: {
                            bitDepth,
                            channelCount: { in: 0, out: 0 },
                        },
                        io: {
                            messageReceivers: {
                                send: {portletIds: ['0']},
                                control: {portletIds: ['0']},
                            },
                            messageSenders: {
                                receive: {portletIds: ['0']},
                                control: {portletIds: ['0']},
                            },
                        }
                    }
                )

                if (compileResult.status !== 0) {
                    throw new Error('Compilation failed')
                }

                const engine = await createTestEngine(
                    target,
                    bitDepth,
                    compileResult.code
                )
                engine.initialize(44100, 1)
                return engine
            }

            it.each(CONTROLS_TEST_PARAMETERS_ALL)(
                'should send / receive messages to specified buses %s',
                async ({ target, bitDepth, nodeType }) => {
                    const engine = await createTestSndRcvEngine(
                        target,
                        bitDepth,
                        nodeType,
                        {
                            ...CONTROL_ARGS_DEFAULT,
                            receiveBusName: 'BUS_TO_CTRL',
                            sendBusName: 'BUS_FROM_CTRL',
                        }
                    )

                    const received: Array<Message> = []
                    const receivedControl: Array<Message> = []

                    engine.io.messageSenders.receive['0'].onMessage = (msg) =>
                        received.push(msg)
                    engine.io.messageSenders.control['0'].onMessage = (msg) =>
                        receivedControl.push(msg)

                    engine.io.messageReceivers.send['0']([666])
                    assert.deepStrictEqual(received, [[666]])
                    assert.deepStrictEqual(receivedControl, [[666]])
                }
            )

            it.each(CONTROLS_TEST_PARAMETERS_ALL)(
                'should send / receive messages to buses on bang %s',
                async ({ target, bitDepth, nodeType }) => {
                    const args = { ...CONTROL_ARGS_DEFAULT }
                    if (nodeType === 'tgl') {
                        args['initValue'] = 0
                    }

                    const engine = await createTestSndRcvEngine(
                        target,
                        bitDepth,
                        nodeType,
                        {
                            ...args,
                            receiveBusName: 'BUS_TO_CTRL',
                            sendBusName: 'BUS_FROM_CTRL',
                        }
                    )

                    const received: Array<Message> = []
                    const receivedControl: Array<Message> = []

                    engine.io.messageSenders.receive['0'].onMessage = (msg) =>
                        received.push(msg)
                    engine.io.messageSenders.control['0'].onMessage = (msg) =>
                        receivedControl.push(msg)

                    engine.io.messageReceivers.send['0'](['bang'])
                    assert.deepStrictEqual(received, [
                        [nodeType === 'tgl' ? args.maxValue : args.initValue],
                    ])
                    assert.deepStrictEqual(receivedControl, [
                        [nodeType === 'tgl' ? args.maxValue : args.initValue],
                    ])
                }
            )

            it.each(CONTROLS_TEST_PARAMETERS_ALL)(
                'should set send / receive buses with send / receive message to control %s',
                async ({ target, bitDepth, nodeType }) => {
                    const engine = await createTestSndRcvEngine(
                        target,
                        bitDepth,
                        nodeType,
                        {
                            ...CONTROL_ARGS_DEFAULT,
                            receiveBusName: 'empty',
                            sendBusName: 'empty',
                        }
                    )

                    const received: Array<Message> = []
                    const receivedControl: Array<Message> = []

                    engine.io.messageSenders.receive['0'].onMessage = (msg) =>
                        received.push(msg)
                    engine.io.messageSenders.control['0'].onMessage = (msg) =>
                        receivedControl.push(msg)

                    engine.io.messageReceivers.send['0']([666])
                    assert.deepStrictEqual(received, [])
                    assert.deepStrictEqual(receivedControl, [])

                    engine.io.messageReceivers.control['0'](['receive', 'BUS_TO_CTRL'])
                    engine.io.messageReceivers.send['0']([888])
                    assert.deepStrictEqual(received, [])
                    assert.deepStrictEqual(receivedControl, [[888]])

                    engine.io.messageReceivers.control['0'](['send', 'BUS_FROM_CTRL'])
                    engine.io.messageReceivers.control['0']([999])
                    assert.deepStrictEqual(received, [[999]])
                    assert.deepStrictEqual(receivedControl, [[888], [999]])
                }
            )
        })

        describe('hsl / hradio / vsl / vradio', () => {
            it.each(CONTROLS_TEST_PARAMETERS_NUMBERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth, nodeType }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders[nodeType], nodeType, {
                                initValue: 0,
                                maxValue: 1000,
                                minValue: -120,
                                outputOnLoad: false,
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations[nodeType],
                        },
                        // Sending float to inlet 0
                        [
                            { ins: { '0': [[2.9], [0.9], [-111]] } },
                            { outs: { '0': [[2.9], [0.9], [-111]] } },
                        ],
                        // Sending bang to inlet 0
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[-111]] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 789], ['bang']] } },
                            { outs: { '0': [[789]] } },
                        ]
                    )
                }
            )
        })

        describe('tgl', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['tgl'], 'tgl', {
                                initValue: 0,
                                minValue: 0,
                                maxValue: 12,
                                outputOnLoad: false,
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations['tgl'],
                        },
                        // Sending float to inlet 0
                        [
                            { ins: { '0': [[2.9], [0.9], [-111]] } },
                            { outs: { '0': [[2.9], [0.9], [-111]] } },
                        ],
                        // Sending bang to inlet 0 toggles between 0 and `maxValue`
                        [
                            { ins: { '0': [['bang'], ['bang']] } },
                            { outs: { '0': [[0], [12]] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 0], ['bang']] } },
                            { outs: { '0': [[12]] } },
                        ]
                    )
                }
            )
        })

        describe('nbx', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['nbx'], 'nbx', {
                                initValue: 0,
                                minValue: -1.5,
                                maxValue: 12,
                                outputOnLoad: false,
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations['nbx'],
                        },
                        // Sending float to inlet 0
                        [
                            { ins: { '0': [[2.9], [0.123]] } },
                            { outs: { '0': [[2.9], [0.123]] } },
                        ],
                        // Sending out of bounds values to inlet 0
                        [
                            { ins: { '0': [[-9], [-111], [12.1]] } },
                            { outs: { '0': [[-1.5], [-1.5], [12]] } },
                        ],
                        // Sending bang to inlet 0
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[12]] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 14], ['bang']] } },
                            { outs: { '0': [[12]] } },
                        ],
                        [
                            { ins: { '0': [['set', 2.55], ['bang']] } },
                            { outs: { '0': [[2.55]] } },
                        ]
                    )
                }
            )
        })
    })
})
