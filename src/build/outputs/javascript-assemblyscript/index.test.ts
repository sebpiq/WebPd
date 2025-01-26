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
import assert from 'assert'
import { builders as buildersSendReceive } from '../../../nodes/nodes/send-receive'
import { builders as buildersControlsFloat } from '../../../nodes/nodes/controls-float'
import { builder } from '../../../nodes/nodes/msg'
import toDspGraph, { CompilationSuccess } from '../../../compile-dsp-graph/to-dsp-graph'
import { applySettingsDefaults } from '.'
import { CompilationSettings } from '@webpd/compiler'
import { makePd } from '../../../compile-dsp-graph/test-helpers'

describe('build.outputs.javascript-assemblyscript', () => {
    describe('applySettingsDefaults', () => {
        it('should add automatically generated messageReceivers for GUI and [send]', async () => {
            // ARRANGE
            const pdJson = makePd({
                patches: {
                    '0': {
                        nodes: {
                            '1': {
                                type: 'msg',
                                args: ['bli'],
                                nodeClass: 'control',
                                layout: {
                                    x: 11,
                                    y: 22,
                                    label: 'bli-msg',
                                } as any,
                            },
                            '2': {
                                type: 'send',
                                args: ['bla'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 33,
                                    y: 44,
                                },
                            },
                            '3': {
                                type: 'hsl',
                                args: [0, 127, 1, 44.4, 'empty', 'empty'],
                                nodeClass: 'control',
                                layout: {
                                    x: 55,
                                    y: 66,
                                    label: 'blu-hsl',
                                } as any,
                            },
                            '4': {
                                type: 's',
                                args: ['blo'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 333,
                                    y: 44,
                                },
                            },
                        },
                    },
                },
            })

            // ACT
            const result = await toDspGraph(
                pdJson,
                {
                    msg: builder,
                    hsl: buildersControlsFloat.hsl,
                    send: buildersSendReceive.send,
                    s: {
                        aliasTo: 'send',
                    },
                },
                () => Promise.reject('could not load abstraction')
            )
            assert.strictEqual(result.status, 0)
            const resultSuccess = result as CompilationSuccess
            const { io, customMetadata } = applySettingsDefaults(
                {},
                resultSuccess.graph,
                pdJson
            )

            // ASSERT
            assert.deepStrictEqual<CompilationSettings['io']['messageReceivers']>(io.messageReceivers, {
                n_0_1: ['0'],
                n_0_2: ['0'],
                n_0_3: ['0'],
                n_0_4: ['0'],
            })

            assert.deepStrictEqual(customMetadata.pdGui, [
                {
                    patchId: '0',
                    pdNodeId: '1',
                    nodeClass: 'control',
                    nodeId: 'n_0_1',
                },
                {
                    patchId: '0',
                    pdNodeId: '3',
                    nodeClass: 'control',
                    nodeId: 'n_0_3',
                },
            ])

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.graph)),
                new Set(['n_0_1', 'n_0_2', 'n_0_3', 'n_0_4'])
            )

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.pdNodes)),
                new Set(['0'])
            )

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.pdNodes['0'])),
                new Set(['1', '3'])
            )
        })

        it('should add automatically generated messageSenders for GUI and [receive]', async () => {
            // ARRANGE
            const pdJson = makePd({
                patches: {
                    '0': {
                        nodes: {
                            '1': {
                                type: 'msg',
                                args: ['bli'],
                                nodeClass: 'control',
                                layout: {
                                    x: 11,
                                    y: 22,
                                    label: 'bli-msg',
                                } as any,
                            },
                            '2': {
                                type: 'receive',
                                args: ['bla'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 33,
                                    y: 44,
                                },
                            },
                            '3': {
                                type: 'hsl',
                                args: [0, 127, 1, 44.4, 'empty', 'empty'],
                                nodeClass: 'control',
                                layout: {
                                    x: 55,
                                    y: 66,
                                    label: 'blu-hsl',
                                } as any,
                            },
                            '4': {
                                type: 'r',
                                args: ['blo'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 333,
                                    y: 44,
                                },
                            },
                        },
                    },
                },
            })

            // ACT
            const result = await toDspGraph(
                pdJson,
                {
                    msg: builder,
                    hsl: buildersControlsFloat.hsl,
                    receive: buildersSendReceive.receive,
                    r: {
                        aliasTo: 'receive',
                    },
                },
                () => Promise.reject('could not load abstraction')
            )
            assert.strictEqual(result.status, 0)
            const resultSuccess = result as CompilationSuccess
            const { io, customMetadata } = applySettingsDefaults(
                {},
                resultSuccess.graph,
                pdJson
            )

            // ASSERT
            assert.deepStrictEqual<CompilationSettings['io']['messageReceivers']>(io.messageSenders, {
                n_0_1: ['0'],
                n_0_2: ['0'],
                n_0_3: ['0'],
                n_0_4: ['0'],
            })

            assert.deepStrictEqual(customMetadata.pdGui, [
                {
                    patchId: '0',
                    pdNodeId: '1',
                    nodeClass: 'control',
                    nodeId: 'n_0_1',
                },
                {
                    patchId: '0',
                    pdNodeId: '3',
                    nodeClass: 'control',
                    nodeId: 'n_0_3',
                },
            ])

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.graph)),
                new Set(['n_0_1', 'n_0_2', 'n_0_3', 'n_0_4'])
            )

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.pdNodes)),
                new Set(['0'])
            )

            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.pdNodes['0'])),
                new Set(['1', '3'])
            )
        })

        it('should not overwrite existing customMetadata', async () => {
            // ARRANGE
            const pdJson = makePd({
                patches: {
                    '0': {
                        nodes: {
                            '1': {
                                type: 'send',
                                args: ['bla'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 33,
                                    y: 44,
                                },
                            },
                        },
                    },
                },
            })

            // ACT
            const result = await toDspGraph(
                pdJson,
                {
                    send: buildersSendReceive.send,
                },
                () => Promise.reject('could not load abstraction')
            )
            assert.strictEqual(result.status, 0)
            const resultSuccess = result as CompilationSuccess
            const { customMetadata } = applySettingsDefaults(
                {
                    customMetadata: {
                        bla: 123,
                    },
                },
                resultSuccess.graph,
                pdJson
            )

            // ASSERT
            assert.deepStrictEqual(customMetadata.bla, 123)
            assert.deepStrictEqual(
                new Set(Object.keys(customMetadata.graph)),
                new Set(['n_0_1'])
            )
        })
    })
})
