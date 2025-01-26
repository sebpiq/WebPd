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

import * as testHelpers from '@webpd/compiler/src/test-helpers'
import { nodeImplementation, builder } from './msg'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeTranslateArgs } from '../test-helpers'
import { builders as sendReceiveBuilders, nodeImplementations as sendReceiveNodeImplementations } from './send-receive'
import compile, { Message } from '@webpd/compiler'
import { createTestEngine } from '@webpd/compiler/src/test-helpers'
import assert from 'assert'

describe('msg', () => {

    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, ['a', 12, 'hello $1'], {
                    msgSpecs: [{ tokens: ['a', 12, 'hello $1'], send: null }],
                })
                testNodeTranslateArgs(builder, ['a', 12, ',', 'hello $1'], {
                    msgSpecs: [
                        { tokens: ['a', 12], send: null }, 
                        { tokens: ['hello $1'], send: null },
                    ],
                })
                testNodeTranslateArgs(builder, [',', 1, ',', 2], {
                    msgSpecs: [
                        { tokens: [1], send: null }, 
                        { tokens: [2], send: null }
                    ],
                })
                testNodeTranslateArgs(builder, [';', 'bla', 1], {
                    msgSpecs: [
                        { tokens: [1], send: 'bla' },
                    ],
                })
                // Ignore ";" if last token
                testNodeTranslateArgs(builder, [666, ';'], {
                    msgSpecs: [
                        { tokens: [666], send: null },
                    ],
                })
                // Same send if several messages after ";"
                testNodeTranslateArgs(builder, [';', 'bla', 'hello', ',', 1, ';', 'blo', 666], {
                    msgSpecs: [
                        { tokens: ['hello'], send: 'bla' },
                        { tokens: [1], send: 'bla' },
                        { tokens: [666], send: 'blo' },
                    ],
                })
            })

            it('should interpret and trim "symbol" prefix', () => {
                testNodeTranslateArgs(builder, ['symbol'], {
                    msgSpecs: [
                        { tokens: [''], send: null }
                    ],
                })
                testNodeTranslateArgs(builder, ['symbol', 'bla'], {
                    msgSpecs: [
                        { tokens: ['bla'], send: null }
                    ],
                })
                testNodeTranslateArgs(builder, ['symbol', 123], {
                    msgSpecs: [
                        { tokens: [''], send: null }
                    ],
                })
                testNodeTranslateArgs(builder, ['symbol', 'poi', 'iop'], {
                    msgSpecs: [{ tokens: ['poi'], send: null }],
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should transfer directly messages without dollar strings %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'msg', {
                            msgSpecs: [{ tokens: [123, 'hello'], send: null }],
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [['bang'], ['blabla'], ['quoi?', 456]],
                            },
                        },
                        {
                            outs: {
                                '0': [
                                    [123, 'hello'],
                                    [123, 'hello'],
                                    [123, 'hello'],
                                ],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should substitute entire dollar strings %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'msg', {
                            msgSpecs: [{ tokens: [123, '$2', '$1'], send: null }],
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    ['wow', 'hehe', 'hoho'],
                                    ['blabla', 456],
                                ],
                            },
                        },
                        {
                            outs: {
                                '0': [
                                    [123, 'hehe', 'wow'],
                                    [123, 456, 'blabla'],
                                ],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should substitute dollar strings within strings %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'msg', {
                            msgSpecs: [{ tokens: ['hello_$2', '$1', 'greetings'], send: null }],
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    ['earth', 'saturn'],
                                    ['satan', 666],
                                ],
                            },
                        },
                        {
                            outs: {
                                '0': [
                                    ['hello_saturn', 'earth', 'greetings'],
                                    ['hello_666', 'satan', 'greetings'],
                                ],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should sequentially send all messages in msgSpecs %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'msg', {
                            msgSpecs: [
                                { tokens: [123, '$1'], send: null }, 
                                { tokens: ['bla-$1'], send: null },
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [['hello'], ['salut']],
                            },
                        },
                        {
                            outs: {
                                '0': [
                                    [123, 'hello'],
                                    ['bla-hello'],
                                    [123, 'salut'],
                                    ['bla-salut'],
                                ],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set new message when using "set" %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'msg', {
                            msgSpecs: [
                                { tokens: [123, '$1'], send: null },
                                { tokens: ['bla-$1'], send: null },
                            ],
                        }),
                        nodeImplementation,
                    },
                    [
                        {
                            ins: {
                                '0': [['set', 'salut', 123]],
                            },
                        },
                        {
                            outs: {
                                '0': [],
                            },
                        },
                    ],
                    [
                        {
                            ins: {
                                '0': [['hello']],
                            },
                        },
                        {
                            outs: {
                                '0': [['salut', 123]],
                            },
                        },
                    ],
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should transfer directly messages without dollar strings %s',
            async ({ target, bitDepth }) => {
                const msgArgs = { msgSpecs: [{ tokens: [123, 'hello'], send: 'BLA' }] }
                const receiveArgs = { busName: 'BLA' }

                const graph = testHelpers.makeGraph({
                    msg: {
                        type: 'msg',
                        ...builder.build(msgArgs),
                        args: msgArgs,
                    },                    
                    receive: {
                        type: 'receive',
                        ...sendReceiveBuilders['receive'].build(receiveArgs),
                        args: receiveArgs,
                    },
                })

                const nodeImplementations = {
                    msg: nodeImplementation,
                    receive: sendReceiveNodeImplementations['receive'],
                }
    
                const compileResult = compile(graph, nodeImplementations, target, {
                    audio: {
                        bitDepth,
                        channelCount: { in: 0, out: 0 },
                    },
                    io: {
                        messageReceivers: {
                            msg: ['0'],
                        },
                        messageSenders: {
                            receive: ['0'],
                        },
                    },
                })
    
                if (compileResult.status !== 0) {
                    throw new Error('Compilation failed')
                }
    
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                    compileResult.code
                )
                engine.initialize(44100, 1)

                const received: Array<Message> = []
                engine.io.messageSenders.receive['0'] = (msg) =>
                    received.push(msg)
                
                engine.io.messageReceivers.msg['0'](['bang'])
                assert.deepStrictEqual(received, [[123, 'hello']])
            }
        )
    })
})
