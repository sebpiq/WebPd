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
    Message,
    NodeImplementations,
} from '@webpd/compiler/src/types'
import {
    nodeImplementation as nodeImplementationSend,
    builder as builderSend,
} from './send'
import {
    nodeImplementation as nodeImplementationReceive,
    builder as builderReceive,
} from './receive'
import {
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { createEngine } from '@webpd/compiler/src/test-helpers'
import assert from 'assert'
import { executeCompilation } from '@webpd/compiler'
import { makeGraph } from '@webpd/compiler/src/dsp-graph/test-helpers'

describe('send / receive', () => {
    describe('builder [send]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderSend, [], {
                    busName: '',
                })
            })
        })
    })

    describe('builder [receive]', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builderReceive, [], {
                    busName: '',
                })
            })
        })
    })

    describe('implementation', () => {
        const createTestEngine = async (
            target: CompilerTarget,
            bitDepth: AudioSettings['bitDepth'],
        ) => {
            const nodeImplementations: NodeImplementations = {
                'send': nodeImplementationSend,
                'receive': nodeImplementationReceive,
            }

            const graph = makeGraph({
                send1: {
                    type: 'send',
                    ...builderSend.build({ busName: 'BUS1' }),
                    args: { busName: 'BUS1' },
                },
                send2: {
                    type: 'send',
                    ...builderSend.build({ busName: 'BUS2' }),
                    args: { busName: 'BUS2' },
                },
                receive1: {
                    type: 'receive',
                    ...builderReceive.build({ busName: 'BUS1' }),
                    args: { busName: 'BUS1' },
                },
                receive2: {
                    type: 'receive',
                    ...builderReceive.build({ busName: 'BUS2' }),
                    args: { busName: 'BUS2' },
                },
                receive2bis: {
                    type: 'receive',
                    ...builderReceive.build({ busName: 'BUS2' }),
                    args: { busName: 'BUS2' },
                },
            })

            const compilation = nodeImplementationsTestHelpers.makeCompilation({
                target,
                graph,
                audioSettings: {
                    bitDepth,
                    channelCount: { in: 0, out: 0 }
                },
                nodeImplementations,
                inletCallerSpecs: {
                    send1: ['0', '1'],
                    send2: ['0'],
                },
                outletListenerSpecs: {
                    receive1: ['0'],
                    receive2: ['0'],
                    receive2bis: ['0'],
                }
            })

            const code = executeCompilation(compilation)
            const engine = await createEngine(compilation.target, bitDepth, code)
            engine.configure(44100, 1)
            return engine
        }

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send / receive messages as expected %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                )

                const received1: Array<Message> = []
                const received2: Array<Message> = []

                engine.outletListeners.receive1['0'].onMessage = (msg) => received1.push(msg)
                engine.outletListeners.receive2['0'].onMessage = (msg) => received2.push(msg)

                engine.inletCallers.send1['0'](['blabla', 123])
                assert.deepStrictEqual(
                    received1,
                    [['blabla', 123]]
                )

                engine.inletCallers.send2['0'](['blo'])
                assert.deepStrictEqual(
                    received2,
                    [['blo']]
                )

                engine.inletCallers.send1['0'](['bang'])
                assert.deepStrictEqual(
                    received1,
                    [['blabla', 123], ['bang']]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change the bus when settings new bus name %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                )

                const received1: Array<Message> = []
                const received2: Array<Message> = []

                engine.outletListeners.receive1['0'].onMessage = (msg) => received1.push(msg)
                engine.outletListeners.receive2['0'].onMessage = (msg) => received2.push(msg)

                engine.inletCallers.send1['1'](['BUS2'])

                engine.inletCallers.send1['0']([666])
                assert.deepStrictEqual(
                    received1,
                    []
                )
                assert.deepStrictEqual(
                    received2,
                    [[666]]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send message to all receivers %s',
            async ({ target, bitDepth }) => {
                const engine = await createTestEngine(
                    target,
                    bitDepth,
                )

                const received2: Array<Message> = []
                const received2bis: Array<Message> = []

                engine.outletListeners.receive2['0'].onMessage = (msg) => received2.push(msg)
                engine.outletListeners.receive2bis['0'].onMessage = (msg) => received2bis.push(msg)

                engine.inletCallers.send2['0']([999])
                assert.deepStrictEqual(
                    received2,
                    [[999]]
                )
                assert.deepStrictEqual(
                    received2bis,
                    [[999]]
                )
            }
        )
    })
})
