/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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
import { makePd } from '@webpd/pd-parser/src/test-helpers'
import assert from 'assert'
import { IoMessageSpecs } from '@webpd/compiler/src/compile/types'
import { builders as buildersSendReceive } from '../../nodes/nodes/send-receive'
import { builders as buildersControlsFloat } from '../../nodes/nodes/controls-float'
import { builder } from '../../nodes/nodes/msg'
import toDspGraph from '../../compile-dsp-graph/to-dsp-graph'
import { buildIoSettingsDefaults } from '.'

describe('build.outputs.io', () => {
    describe('collectIoDefaults', () => {
        it('should add automatically generated messageReceivers for GUI and [send]', async () => {
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
            const { io, customMetadata } = buildIoSettingsDefaults(
                {},
                result.graph,
                pdJson
            )

            assert.deepStrictEqual<IoMessageSpecs>(io.messageReceivers, {
                n_0_1: ['0'],
                n_0_2: ['0'],
                n_0_3: ['0'],
                n_0_4: ['0'],
            })

            assert.deepStrictEqual(customMetadata.messageReceivers, [
                {
                    group: 'control',
                    type: 'msg',
                    nodeId: 'n_0_1',
                    portletId: '0',
                    label: 'bli-msg',
                    position: [11, 22],
                },
                {
                    group: 'control:float',
                    type: 'hsl',
                    nodeId: 'n_0_3',
                    portletId: '0',
                    label: 'blu-hsl',
                    minValue: 0,
                    maxValue: 127,
                    initValue: 44.4,
                    position: [55, 66],
                },
                {
                    group: 'send',
                    name: 'bla',
                    nodeId: 'n_0_2',
                    portletId: '0',
                    position: [33, 44],
                },
                {
                    group: 'send',
                    name: 'blo',
                    nodeId: 'n_0_4',
                    portletId: '0',
                    position: [333, 44],
                },
            ])
        })

        it('should add automatically generated messageSenders for GUI and [receive]', async () => {
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
            const { io, customMetadata } = buildIoSettingsDefaults(
                {},
                result.graph,
                pdJson
            )

            assert.deepStrictEqual<IoMessageSpecs>(io.messageSenders, {
                n_0_1: ['0'],
                n_0_2: ['0'],
                n_0_3: ['0'],
                n_0_4: ['0'],
            })

            assert.deepStrictEqual(customMetadata.messageSenders, [
                {
                    group: 'control',
                    type: 'msg',
                    nodeId: 'n_0_1',
                    portletId: '0',
                    label: 'bli-msg',
                    position: [11, 22],
                },
                {
                    group: 'control:float',
                    type: 'hsl',
                    nodeId: 'n_0_3',
                    portletId: '0',
                    label: 'blu-hsl',
                    minValue: 0,
                    maxValue: 127,
                    initValue: 44.4,
                    position: [55, 66],
                },
                {
                    group: 'receive',
                    name: 'bla',
                    nodeId: 'n_0_2',
                    portletId: '0',
                    position: [33, 44],
                },
                {
                    group: 'receive',
                    name: 'blo',
                    nodeId: 'n_0_4',
                    portletId: '0',
                    position: [333, 44],
                },
            ])
        })

        it('should not overwrite existing customMetadata', async () => {
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

            const result = await toDspGraph(
                pdJson,
                {
                    send: buildersSendReceive.send,
                },
                () => Promise.reject('could not load abstraction')
            )
            assert.strictEqual(result.status, 0)
            const { customMetadata } = buildIoSettingsDefaults(
                {
                    customMetadata: {
                        bla: 123,
                    },
                },
                result.graph,
                pdJson
            )

            assert.deepStrictEqual(customMetadata, {
                bla: 123,
                messageReceivers: [
                    {
                        group: 'send',
                        name: 'bla',
                        nodeId: 'n_0_1',
                        portletId: '0',
                        position: [33, 44],
                    },
                ],
                messageSenders: [],
            })
        })
    })
})
