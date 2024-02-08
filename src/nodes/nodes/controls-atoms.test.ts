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
    testNodeTranslateArgs,
    testParametersCombine,
} from '../test-helpers'
import { nodeImplementations, builders, NodeArguments } from './controls-atoms'
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

const NODE_TYPES = ['symbolatom', 'listbox', 'floatatom'] as const

const CONTROLS_TEST_PARAMETERS = testParametersCombine<{
    nodeType: keyof typeof builders
}>('nodeType', NODE_TYPES)

describe('controls-atoms', () => {
    describe('builders', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builders['symbolatom'], [-11, 11], {
                    receiveBusName: 'empty',
                    sendBusName: 'empty',
                })
                testNodeTranslateArgs(
                    builders['symbolatom'],
                    [-11, 11, 'RCV', 'SND'],
                    {
                        receiveBusName: 'RCV',
                        sendBusName: 'SND',
                    }
                )
            })
        })
    })

    describe('implementation', () => {
        const getTestMessage = (
            nodeType: keyof typeof nodeImplementations,
            value: Message
        ) => {
            switch (nodeType) {
                case 'listbox':
                    return value
                case 'symbolatom':
                    return [value[0].toString()]
                case 'floatatom':
                    return [value[0]]
            }
        }

        describe('message send / receive', () => {
            const CONTROL_ARGS_DEFAULT = {
                outputOnLoad: false,
            }

            const createTestSndRvcEngine = async (
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
                                send: { portletIds: ['0'] },
                                control: { portletIds: ['0'] },
                            },
                            messageSenders: {
                                receive: { portletIds: ['0'] },
                                control: { portletIds: ['0'] },
                            },
                        },
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

            it.each(CONTROLS_TEST_PARAMETERS)(
                'should send / receive messages to specified buses %s',
                async ({ target, bitDepth, nodeType }) => {
                    const engine = await createTestSndRvcEngine(
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

                    engine.io.messageReceivers.send['0'](
                        getTestMessage(nodeType, [666])
                    )
                    assert.deepStrictEqual(received, [
                        getTestMessage(nodeType, [666]),
                    ])
                    assert.deepStrictEqual(receivedControl, [
                        getTestMessage(nodeType, [666]),
                    ])
                }
            )

            it.each(CONTROLS_TEST_PARAMETERS)(
                'should send / receive messages to buses on bang %s',
                async ({ target, bitDepth, nodeType }) => {
                    const args = { ...CONTROL_ARGS_DEFAULT }

                    const engine = await createTestSndRvcEngine(
                        target,
                        bitDepth,
                        nodeType,
                        {
                            ...args,
                            receiveBusName: 'BUS_TO_CTRL',
                            sendBusName: 'BUS_FROM_CTRL',
                        }
                    )

                    // Initialize value
                    engine.io.messageReceivers.control['0'](
                        getTestMessage(nodeType, [789])
                    )

                    const received: Array<Message> = []
                    const receivedControl: Array<Message> = []

                    engine.io.messageSenders.receive['0'].onMessage = (msg) =>
                        received.push(msg)
                    engine.io.messageSenders.control['0'].onMessage = (msg) =>
                        receivedControl.push(msg)

                    engine.io.messageReceivers.send['0'](['bang'])
                    assert.deepStrictEqual(received, [
                        getTestMessage(nodeType, [789]),
                    ])
                    assert.deepStrictEqual(receivedControl, [
                        getTestMessage(nodeType, [789]),
                    ])
                }
            )

            it.each(CONTROLS_TEST_PARAMETERS)(
                'should set send / receive buses with send / receive message to control %s',
                async ({ target, bitDepth, nodeType }) => {
                    const engine = await createTestSndRvcEngine(
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

                    engine.io.messageReceivers.send['0'](
                        getTestMessage(nodeType, [666])
                    )
                    assert.deepStrictEqual(received, [])
                    assert.deepStrictEqual(receivedControl, [])

                    engine.io.messageReceivers.control['0']([
                        'receive',
                        'BUS_TO_CTRL',
                    ])
                    engine.io.messageReceivers.send['0'](
                        getTestMessage(nodeType, [888])
                    )
                    assert.deepStrictEqual(received, [])
                    assert.deepStrictEqual(receivedControl, [
                        getTestMessage(nodeType, [888]),
                    ])

                    engine.io.messageReceivers.control['0']([
                        'send',
                        'BUS_FROM_CTRL',
                    ])
                    engine.io.messageReceivers.control['0'](
                        getTestMessage(nodeType, [999])
                    )
                    assert.deepStrictEqual(received, [
                        getTestMessage(nodeType, [999]),
                    ])
                    assert.deepStrictEqual(receivedControl, [
                        getTestMessage(nodeType, [888]),
                        getTestMessage(nodeType, [999]),
                    ])
                }
            )
        })

        describe('floatatom', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(
                                builders['floatatom'],
                                'floatatom',
                                {
                                    receiveBusName: 'empty',
                                    sendBusName: 'empty',
                                }
                            ),
                            nodeImplementation:
                                nodeImplementations['floatatom'],
                        },
                        // Sending string to inlet 0
                        [
                            { ins: { '0': [[333], [666]] } },
                            { outs: { '0': [[333], [666]] } },
                        ],
                        // Sending bang to inlet 0
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[666]] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 999], ['bang']] } },
                            { outs: { '0': [[999]] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should be initialized with 0 %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(
                                builders['floatatom'],
                                'floatatom',
                                {
                                    receiveBusName: 'empty',
                                    sendBusName: 'empty',
                                }
                            ),
                            nodeImplementation:
                                nodeImplementations['floatatom'],
                        },
                        [{ ins: { '0': [['bang']] } }, { outs: { '0': [[0]] } }]
                    )
                }
            )
        })

        describe('symbolatom', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(
                                builders['symbolatom'],
                                'symbolatom',
                                {
                                    receiveBusName: 'empty',
                                    sendBusName: 'empty',
                                }
                            ),
                            nodeImplementation:
                                nodeImplementations['symbolatom'],
                        },
                        // Sending string to inlet 0
                        [
                            { ins: { '0': [['bla'], ['oip oip;oipoipoip']] } },
                            { outs: { '0': [['bla'], ['oip oip;oipoipoip']] } },
                        ],
                        // Sending bang to inlet 0
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [['oip oip;oipoipoip']] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 'hello'], ['bang']] } },
                            { outs: { '0': [['hello']] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should be initialized with empty string %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(
                                builders['symbolatom'],
                                'symbolatom',
                                {
                                    receiveBusName: 'empty',
                                    sendBusName: 'empty',
                                }
                            ),
                            nodeImplementation:
                                nodeImplementations['symbolatom'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [['']] } },
                        ]
                    )
                }
            )
        })

        describe('listbox', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should handle messages as expected %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['listbox'], 'listbox', {
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations['listbox'],
                        },
                        // Sending string to inlet 0
                        [
                            {
                                ins: {
                                    '0': [
                                        ['bla', 909],
                                        [123, 'hello'],
                                    ],
                                },
                            },
                            {
                                outs: {
                                    '0': [
                                        ['bla', 909],
                                        [123, 'hello'],
                                    ],
                                },
                            },
                        ],
                        // Sending bang to inlet 0
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[123, 'hello']] } },
                        ],
                        // Setting the value using 'set'
                        [
                            { ins: { '0': [['set', 'hello', 666], ['bang']] } },
                            { outs: { '0': [['hello', 666]] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should be initialized with bang list %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['listbox'], 'listbox', {
                                receiveBusName: 'empty',
                                sendBusName: 'empty',
                            }),
                            nodeImplementation: nodeImplementations['listbox'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [['bang']] } },
                        ]
                    )
                }
            )
        })
    })
})
