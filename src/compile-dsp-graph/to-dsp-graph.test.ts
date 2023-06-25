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
import toDspGraph, {
    Compilation,
    _buildNodes,
    _buildConnections,
    buildImplicitGraphNodeId,
} from './to-dsp-graph'
import {
    assertGraphConnections,
    assertGraphsEqual,
    assertNodesEqual,
} from '@webpd/compiler/src/dsp-graph/test-helpers'
import { NodeBuilders } from './types'
import { nodeBuilders as subpatchNodeBuilders } from '../nodes/nodes/subpatch'
import { builder as mixerNodeBuilder } from '../nodes/nodes/_mixer~'
import { builder as routeMsgBuilder } from '../nodes/nodes/_routemsg'
import { builder as sigNodeBuilder } from '../nodes/nodes/sig~'
import { DspGraph } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import {
    pdJsonNodeDefaults,
    pdJsonDefaults,
    makePd,
} from '@webpd/pd-parser/src/test-helpers'
import { AbstractionLoader } from './instantiate-abstractions'

const DUMMY_NODE_TYPE = pdJsonNodeDefaults('').type

const DEFAULT_NODE_BUILDERS: NodeBuilders = {
    ...subpatchNodeBuilders,
    '_mixer~': mixerNodeBuilder,
    '_routemsg': routeMsgBuilder,
    'sig~': sigNodeBuilder,
    [DUMMY_NODE_TYPE]: {
        translateArgs: () => ({}),
        build: () => ({
            inlets: {
                '0': { type: 'message', id: '0' },
            },
            outlets: {
                '0': { type: 'message', id: '0' },
            },
        }),
    },
}

const makeDefaultCompilation = (): Compilation => ({
    pd: pdJsonDefaults(),
    nodeBuilders: DEFAULT_NODE_BUILDERS,
    graph: {},
})

describe('toDspGraph', () => {
    describe('default', () => {
        const NODE_BUILDERS: NodeBuilders = {
            ...DEFAULT_NODE_BUILDERS,
            'tabread~': {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: {
                        '0': { type: 'signal', id: '0' },
                        '0_message': { type: 'message', id: '0_message' },
                    },
                    outlets: { '0': { type: 'signal', id: '0' } },
                }),
                configureMessageToSignalConnection: (inletId) => {
                    if (inletId === '0') {
                        return { reroutedMessageInletId: '0_message' }
                    }
                    return undefined
                },
            },
            'osc~': {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: {
                        '0': { type: 'signal', id: '0' },
                    },
                    outlets: { '0': { type: 'signal', id: '0' } },
                }),
                configureMessageToSignalConnection: (inletId) => {
                    if (inletId === '0') {
                        return { initialSignalValue: 222 }
                    }
                    return undefined
                },
            },
            msg: {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: { '0': { type: 'message', id: '0' } },
                    outlets: { '0': { type: 'message', id: '0' } },
                }),
            },
            graph: {
                isNoop: true,
            },
            [DUMMY_NODE_TYPE]: {
                translateArgs: ({ args }) => ({ argsCopy: args }),
                build: () => ({
                    inlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                        '2': { type: 'message', id: '2' },
                    },
                    outlets: {
                        '0': { type: 'message', id: '0' },
                        '1': { type: 'message', id: '1' },
                        '2': { type: 'message', id: '2' },
                    },
                }),
            },
        }

        it('should inline subpatch simple', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            n1: {},
                            n2: {},
                            spNode: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                            },
                            n3: {},
                            n4: {},
                        },
                        connections: [
                            ['n1', 0, 'spNode', 0],
                            ['n1', 1, 'spNode', 0],
                            ['n2', 0, 'spNode', 0],
                            ['n2', 0, 'spNode', 1],
                            ['spNode', 0, 'n3', 0],
                            ['spNode', 1, 'n3', 0],
                            ['spNode', 0, 'n4', 0],
                            ['spNode', 0, 'n4', 1],
                        ],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            inlet1: { type: 'inlet' },
                            inlet2: { type: 'inlet' },
                            n5: {},
                            n6: {},
                            outlet1: { type: 'outlet' },
                            outlet2: { type: 'outlet' },
                        },
                        connections: [
                            ['inlet1', 0, 'n5', 0],
                            ['inlet1', 0, 'n5', 1],
                            ['inlet1', 0, 'n6', 0],
                            ['inlet2', 0, 'n6', 1],
                            ['n5', 0, 'outlet1', 0],
                            ['n5', 1, 'outlet1', 0],
                            ['n6', 0, 'outlet1', 0],
                            ['n6', 0, 'outlet2', 0],
                        ],
                        inlets: ['inlet1', 'inlet2'],
                        outlets: ['outlet1', 'outlet2'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph, arrays } = compilationResult

            assertGraphConnections(graph, [
                // ['n1', 0, 'spNode', 0],
                ['n_0_n1', '0', 'n_1_n5', '0'],
                ['n_0_n1', '0', 'n_1_n5', '1'],
                ['n_0_n1', '0', 'n_1_n6', '0'],
                // ['n1', 1, 'spNode', 0],
                ['n_0_n1', '1', 'n_1_n5', '0'],
                ['n_0_n1', '1', 'n_1_n5', '1'],
                ['n_0_n1', '1', 'n_1_n6', '0'],
                // ['n2', 0, 'spNode', 0],
                ['n_0_n2', '0', 'n_1_n5', '0'],
                ['n_0_n2', '0', 'n_1_n5', '1'],
                ['n_0_n2', '0', 'n_1_n6', '0'],
                // ['n2', 0, 'spNode', 1],
                ['n_0_n2', '0', 'n_1_n6', '1'],
                // ['spNode', 0, 'n3', 0]
                ['n_1_n5', '0', 'n_0_n3', '0'],
                ['n_1_n5', '1', 'n_0_n3', '0'],
                ['n_1_n6', '0', 'n_0_n3', '0'],
                // ['spNode', 1, 'n3', 0],
                ['n_1_n6', '0', 'n_0_n3', '0'],
                // ['spNode', 0, 'n4', 0],
                ['n_1_n5', '0', 'n_0_n4', '0'],
                ['n_1_n5', '1', 'n_0_n4', '0'],
                ['n_1_n6', '0', 'n_0_n4', '0'],
                // ['spNode', 0, 'n4', 1],
                ['n_1_n5', '0', 'n_0_n4', '1'],
                ['n_1_n5', '1', 'n_0_n4', '1'],
                ['n_1_n6', '0', 'n_0_n4', '1'],
            ])

            assert.deepStrictEqual(arrays, {})
        })

        it('should inline subpatch with several levels of nesting', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    // Connected nodes
                    '0': {
                        nodes: {
                            n1: {},
                            sp: {
                                nodeClass: 'subpatch',
                                type: 'pd',
                                patchId: '1',
                            },
                            n2: {},
                        },
                        connections: [
                            ['n1', 1, 'sp', 0],
                            ['sp', 0, 'n2', 2],
                        ],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            inletNode: { type: 'inlet' },
                            ssp: {
                                nodeClass: 'subpatch',
                                type: 'pd',
                                patchId: '2',
                            },
                            outletNode: { type: 'outlet' },
                        },
                        connections: [
                            ['inletNode', 0, 'ssp', 0],
                            ['ssp', 0, 'outletNode', 0],
                        ],
                        inlets: ['inletNode'],
                        outlets: ['outletNode'],
                    },
                    '2': {
                        isRoot: false,
                        nodes: {
                            inletNode: { type: 'inlet' },
                            n1: {},
                            outletNode: { type: 'outlet' },
                        },
                        connections: [
                            ['inletNode', 0, 'n1', 1],
                            ['n1', 2, 'outletNode', 0],
                        ],
                        inlets: ['inletNode'],
                        outlets: ['outletNode'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    n_0_n1: {},
                    n_2_n1: {},
                    n_0_n2: {},
                },
                true
            )

            assertGraphConnections(graph, [
                ['n_0_n1', '1', 'n_2_n1', '1'],
                ['n_2_n1', '2', 'n_0_n2', '2'],
            ])
        })

        it('should be able to handle message connection to subpatch signal inlet', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            spNode: {
                                type: 'pd',
                                patchId: '1',
                                nodeClass: 'subpatch',
                            },
                            msg: { type: 'msg' },
                        },
                        connections: [['msg', 0, 'spNode', 0]],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            inletNode: { type: 'inlet~' },
                            tabread: { type: 'tabread~' },
                        },
                        connections: [['inletNode', 0, 'tabread', 0]],
                        inlets: ['inletNode'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    n_0_msg: {},
                    n_1_tabread: {},
                    "m_n_1_tabread_0__routemsg": {},
                    "m_n_1_tabread_0_sig": {},
                },
                true
            )
            assertGraphConnections(graph, [
                ['n_0_msg', '0', 'm_n_1_tabread_0__routemsg', '0'],
                ['m_n_1_tabread_0__routemsg', '0', 'm_n_1_tabread_0_sig', '0'],
                ['m_n_1_tabread_0_sig', '0', 'n_1_tabread', '0'],
                ['m_n_1_tabread_0__routemsg', '1', 'n_1_tabread', '0_message'],
            ])
        })

        it('should be able to handle message connection from subpatch signal outlet', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            spNode: {
                                type: 'pd',
                                patchId: '1',
                                nodeClass: 'subpatch',
                            },
                            tabread: { type: 'tabread~' },
                        },
                        connections: [['spNode', 0, 'tabread', 0]],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            msg: { type: 'msg' },
                            outletNode: { type: 'outlet~' },
                        },
                        connections: [['msg', 0, 'outletNode', 0]],
                        outlets: ['outletNode'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    n_1_msg: {},
                    n_0_tabread: {},
                    "m_n_0_tabread_0__routemsg": {},
                    "m_n_0_tabread_0_sig": {},
                },
                true
            )
            assertGraphConnections(graph, [
                ['n_1_msg', '0', 'm_n_0_tabread_0__routemsg', '0'],
                ['m_n_0_tabread_0__routemsg', '0', 'm_n_0_tabread_0_sig', '0'],
                ['m_n_0_tabread_0__routemsg', '1', 'n_0_tabread', '0_message'],
                ['m_n_0_tabread_0_sig', '0', 'n_0_tabread', '0'],
            ])
        })

        it('should be able to handle multiple signal connections from one subpatch to another', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            pd1: {
                                type: 'pd',
                                patchId: '1',
                                nodeClass: 'subpatch',
                            },
                            pd2: {
                                type: 'pd',
                                patchId: '2',
                                nodeClass: 'subpatch',
                            },
                        },
                        connections: [
                            ['pd1', 0, 'pd2', 0],
                            ['pd1', 1, 'pd2', 0],
                        ],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            outlet1: {
                                type: 'outlet~',
                            },
                            outlet2: {
                                type: 'outlet~',
                            },
                            tabread2: {
                                type: 'tabread~',
                            },
                            tabread3: {
                                type: 'tabread~',
                            },
                        },
                        connections: [
                            ['tabread2', 0, 'outlet1', 0],
                            ['tabread3', 0, 'outlet2', 0],
                        ],
                        inlets: [],
                        outlets: ['outlet1', 'outlet2'],
                    },
                    '2': {
                        isRoot: false,
                        nodes: {
                            inlet1: {
                                type: 'inlet~',
                            },
                            tabread1: {
                                type: 'tabread~',
                            },
                        },
                        connections: [['inlet1', 0, 'tabread1', 0]],
                        inlets: ['inlet1'],
                        outlets: [],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphConnections(graph, [
                ['m_n_1_tabread2_0_sig', '0', 'n_1_tabread2', '0'],
                ['n_1_tabread2', '0', 'm_n_2_tabread1_0__mixer', '0'],
                ['m_n_1_tabread3_0_sig', '0', 'n_1_tabread3', '0'],
                ['n_1_tabread3', '0', 'm_n_2_tabread1_0__mixer', '1'],
                ['n_1_tabread3', '0', 'm_n_2_tabread1_0__mixer', '1'],
                ['m_n_2_tabread1_0__mixer', '0', 'n_2_tabread1', '0'],
            ])
        })

        it('should handle several signal connections, one local, one from parent', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            '0': {
                                type: 'tabread~',
                            },
                            '1': {
                                type: 'pd',
                                patchId: '1',
                                nodeClass: 'subpatch',
                            },
                        },
                        connections: [['0', 0, '1', 0]],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            '0': { type: 'inlet~' },
                            '1': { type: 'tabread~' },
                            '2': { type: 'tabread~' },
                        },
                        connections: [
                            ['0', 0, '2', 0],
                            ['1', 0, '2', 0],
                        ],
                        inlets: ['0'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphConnections(graph, [
                ['m_n_0_0_0_sig', '0', 'n_0_0', '0'],
                ['m_n_1_1_0_sig', '0', 'n_1_1', '0'],
                ['n_0_0', '0', 'm_n_1_2_0__mixer', '0'],
                ['n_1_1', '0', 'm_n_1_2_0__mixer', '1'],
                ['m_n_1_2_0__mixer', '0', 'n_1_2', '0'],
            ])
        })

        it('should inline subpatch with a passthrough connection', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            n1: {},
                            sp: {
                                nodeClass: 'subpatch',
                                type: 'pd',
                                patchId: '1',
                            },
                            n2: {},
                        },
                        connections: [
                            ['n1', 0, 'sp', 0],
                            ['sp', 0, 'n2', 0],
                        ],
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            inlet1: { type: 'inlet' },
                            n3: {},
                            outlet1: { type: 'outlet' },
                        },
                        connections: [
                            ['inlet1', 0, 'outlet1', 0],
                            ['n3', 0, 'outlet1', 0],
                        ],
                        inlets: ['inlet1'],
                        outlets: ['outlet1'],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphConnections(graph, [
                ['n_0_n1', '0', 'n_0_n2', '0'],
                ['n_1_n3', '0', 'n_0_n2', '0'],
            ])
        })

        it('should be not fail if subpatch was a noop and was deleted at buildNode stage', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            spNode: {
                                type: 'graph',
                                patchId: '1',
                                nodeClass: 'subpatch',
                            },
                        },
                    },
                    '1': {
                        isRoot: false,
                        nodes: {},
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(graph, {}, true)
        })

        it('should be able to handle abstractions', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            n1: { args: ['$0'] },
                            abs1: { type: 'abstract1', args: [123] },
                            abs2: { type: 'abstract2', args: ['$0', 'hello'] },
                            n2: {},
                        },
                        connections: [
                            ['n1', 0, 'abs1', 0],
                            ['abs1', 0, 'abs2', 0],
                            ['abs2', 0, 'n2', 0],
                        ],
                    },
                },
                rootPatchId: '0',
            })

            const abstract1: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            in1: { type: 'inlet' },
                            abs2: { type: 'abstract2', args: ['$0', '$1'] },
                            out1: { type: 'outlet' },
                        },
                        connections: [
                            ['in1', 0, 'abs2', 0],
                            ['abs2', 0, 'out1', 0],
                        ],
                        inlets: ['in1'],
                        outlets: ['out1'],
                    },
                },
            })

            const abstract2: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            in1: { type: 'inlet' },
                            n1: { args: ['$0', '$1', '$2'] },
                            out1: { type: 'outlet' },
                        },
                        connections: [
                            ['in1', 0, 'n1', 0],
                            ['n1', 0, 'out1', 0],
                        ],
                        inlets: ['in1'],
                        outlets: ['out1'],
                    },
                },
            })

            const loadAbstraction: AbstractionLoader = async (
                nodeType: PdJson.NodeType
            ) => {
                switch (nodeType) {
                    case 'abstract1':
                        return { status: 0, pd: abstract1 }
                    case 'abstract2':
                        return { status: 0, pd: abstract2 }
                    default:
                        return { status: 1, unknownNodeType: nodeType }
                }
            }

            const compilationResult = await toDspGraph(
                pd,
                NODE_BUILDERS,
                loadAbstraction
            )
            assert.ok(compilationResult.status === 0)
            const { graph, pd: pdWithResolvedAbstractions } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    // Main patch
                    n_0_n1: { args: { argsCopy: [0] } },
                    n_0_n2: { args: { argsCopy: [] } },
                    // Abs 2 in abs1 in main patch
                    n_2_n1: { args: { argsCopy: [2, 1, 123] } },
                    // Abs 2 in main patch
                    n_3_n1: { args: { argsCopy: [3, 0, 'hello'] } },
                },
                true
            )

            assert.strictEqual(pdWithResolvedAbstractions.rootPatchId, '0')

            assertGraphConnections(graph, [
                ['n_0_n1', '0', 'n_2_n1', '0'],
                ['n_2_n1', '0', 'n_3_n1', '0'],
                ['n_3_n1', '0', 'n_0_n2', '0'],
            ])
        })

        it('should be able to handle subpatch inside abstraction', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            abs1: { type: 'abstract1', args: [123] },
                        },
                    },
                },
            })

            const abstract1: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            n1: {},
                            sp: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                            },
                        },
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            n1: {},
                        },
                    },
                },
            })

            const loadAbstraction: AbstractionLoader = async (
                nodeType: PdJson.NodeType
            ) => {
                switch (nodeType) {
                    case 'abstract1':
                        return { status: 0, pd: abstract1 }
                    default:
                        return { status: 1, unknownNodeType: nodeType }
                }
            }

            const compilationResult = await toDspGraph(
                pd,
                NODE_BUILDERS,
                loadAbstraction
            )
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    n_1_n1: {},
                    n_2_n1: {},
                },
                true
            )
        })

        it('should return errors from failed abstraction loading', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            n1: { type: 'unknownNodeType' },
                            n2: { type: 'typeWithParsingErrors' },
                        },
                    },
                },
            })

            const loadAbstraction: AbstractionLoader = async (nodeType) => {
                if (nodeType === 'unknownNodeType') {
                    return { status: 1, unknownNodeType: nodeType }
                } else {
                    return {
                        status: 1,
                        parsingErrors: [
                            { message: 'some error', lineIndex: 666 },
                        ],
                        parsingWarnings: [
                            { message: 'some warning', lineIndex: 999 },
                        ],
                    }
                }
            }

            const compilationResult = await toDspGraph(
                pd,
                NODE_BUILDERS,
                loadAbstraction
            )
            assert.ok(compilationResult.status === 1)

            const { abstractionsLoadingErrors, abstractionsLoadingWarnings } =
                compilationResult
            assert.deepStrictEqual(abstractionsLoadingErrors, {
                unknownNodeType: {
                    unknownNodeType: 'unknownNodeType',
                },
                typeWithParsingErrors: {
                    parsingErrors: [{ message: 'some error', lineIndex: 666 }],
                },
            })

            assert.deepStrictEqual(abstractionsLoadingWarnings, {
                typeWithParsingErrors: [
                    { message: 'some warning', lineIndex: 999 },
                ],
            })
        })

        it('should load arrays properly', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            array1: {
                                type: 'array',
                                nodeClass: 'array',
                                arrayId: '0',
                            },
                            sp: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                            },
                        },
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            array1: {
                                type: 'array',
                                nodeClass: 'array',
                                arrayId: '1',
                            },
                        },
                    },
                },
                arrays: {
                    '0': {
                        args: ['$0', 8, 1],
                        data: [11, 22, 33, 44, 55, 66, 77, 88],
                    },
                    '1': {
                        args: ['bla-$0', 4, 0],
                        data: null,
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                ...DEFAULT_NODE_BUILDERS,
                array: { isNoop: true },
            }

            const compilationResult = await toDspGraph(pd, nodeBuilders)
            assert.ok(compilationResult.status === 0)
            const { arrays } = compilationResult

            assert.deepStrictEqual(arrays, {
                '0': new Float32Array([11, 22, 33, 44, 55, 66, 77, 88]),
                'bla-0': new Float32Array([0, 0, 0, 0]),
            })
        })

        it('should not fail when patch is itself an abstraction', async () => {
            const pd = makePd({
                rootPatchId: '0',
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            '0': {
                                type: 'inlet~',
                            },
                            '1': {
                                type: 'tabread~',
                                args: [220],
                            },
                            '2': {
                                type: 'outlet~',
                            },
                        },
                        connections: [
                            ['0', 0, '1', 0],
                            ['1', 0, '2', 0],
                        ],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphsEqual(
                graph,
                {
                    n_0_1: { type: 'tabread~' },
                    'm_n_0_1_0_sig': { type: 'sig~' }
                },
                true
            )
            assertGraphConnections(graph, [['m_n_0_1_0_sig', '0', 'n_0_1', '0']])
        })
    })

    describe('buildImplicitGraphNodeId', () => {
        it('should remove special chars', () => {
            assert.strictEqual(buildImplicitGraphNodeId('nodeId', 'inletId', 'sig~'), 'm_nodeId_inletId_sig')
        })
    })

    describe('_buildNodes', () => {
        it('should build nodes from a patch object', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    // Connected nodes
                    '0': {
                        nodes: {
                            n1: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                            },
                            n2: {},
                        },
                        connections: [['n1', 0, 'n2', 0]],
                    },
                    // A node with no connections
                    '1': {
                        isRoot: false,
                        nodes: {
                            n1: {},
                            outlet1: { type: 'outlet' },
                        },
                        connections: [['n1', 0, 'outlet1', 0]],
                        outlets: ['outlet1'],
                    },
                },
            })
            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildNodes(compilation, [pd.patches['0']!, pd.patches['1']!])

            assert.deepStrictEqual<DspGraph.Graph>(compilation.graph, {
                n_0_n1: {
                    args: {},
                    id: 'n_0_n1',
                    type: 'pd',
                    sources: {},
                    sinks: {},
                    inlets: {},
                    outlets: {},
                },
                n_0_n2: {
                    args: {},
                    id: 'n_0_n2',
                    type: DUMMY_NODE_TYPE,
                    sources: {},
                    sinks: {},
                    inlets: {
                        '0': {
                            id: '0',
                            type: 'message',
                        },
                    },
                    outlets: {
                        '0': {
                            id: '0',
                            type: 'message',
                        },
                    },
                },
                n_1_n1: {
                    args: {},
                    id: 'n_1_n1',
                    type: DUMMY_NODE_TYPE,
                    sinks: {},
                    sources: {},
                    inlets: {
                        '0': {
                            id: '0',
                            type: 'message',
                        },
                    },
                    outlets: {
                        '0': {
                            id: '0',
                            type: 'message',
                        },
                    },
                },
                n_1_outlet1: {
                    args: {},
                    id: 'n_1_outlet1',
                    type: 'outlet',
                    sinks: {},
                    sources: {},
                    inlets: {},
                    outlets: {},
                },
            })
        })

        it('should use node builder aliasTo if declared', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            someNode: {
                                type: 't',
                            },
                        },
                        connections: [],
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                t: {
                    aliasTo: 'someNodeType',
                },
                someNodeType: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: {
                            someInlet: { type: 'message', id: 'someInlet' },
                        },
                        outlets: {},
                    }),
                },
            }

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])

            assertGraphsEqual(
                compilation.graph,
                {
                    n_0_someNode: {
                        inlets: {
                            someInlet: { type: 'message', id: 'someInlet' },
                        },
                    },
                },
                true
            )
        })

        it('should remove nodes whose builder declares isNoop = true', () => {
            // Connect some nodes to make sure that doesn't cause a problem
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            someSourceNode: {
                                type: 'someNodeType',
                            },
                            someNode: {
                                type: 'someUselessNodeType',
                            },
                            someSinkNode: {
                                type: 'someNodeType',
                            },
                        },
                        connections: [
                            ['someSourceNode', 0, 'someNode', 0],
                            ['someNode', 0, 'someSinkNode', 0],
                        ],
                    },
                },
            })
            const nodeBuilders: NodeBuilders = {
                someUselessNodeType: {
                    isNoop: true,
                },
                someNodeType: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: {
                            '0': { id: '0', type: 'message' },
                        },
                        outlets: {
                            '0': { id: '0', type: 'message' },
                        },
                    }),
                },
            }

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(
                Object.keys(compilation.graph).sort(),
                ['n_0_someSourceNode', 'n_0_someSinkNode'].sort()
            )
        })

        it('should resolve $ args with patches args', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            someNode: {
                                args: ['$0-bla', '$1', '$2', 'hello-$2'],
                            },
                            subpatchNode: {
                                nodeClass: 'subpatch',
                                type: 'pd',
                                patchId: '1',
                            },
                        },
                        connections: [],
                        args: ['bla', 1234],
                    },
                    // Subpatch node args should be resolved using root patch's args
                    '1': {
                        isRoot: false,
                        nodes: {
                            someNode: {
                                args: ['$2'],
                            },
                        },
                        connections: [],
                        args: ['poi', 9999],
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                ...DEFAULT_NODE_BUILDERS,
                [DUMMY_NODE_TYPE]: {
                    translateArgs: ({ args }) => ({ args }),
                    build: () => ({
                        inlets: {},
                        outlets: {},
                    }),
                },
            }

            let compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            assert.deepStrictEqual(compilation.graph.n_0_someNode!.args, {
                args: ['0-bla', 'bla', 1234, 'hello-1234'],
            })

            compilation = { ...makeDefaultCompilation(), pd, nodeBuilders }
            _buildNodes(compilation, [pd.patches['0']!, pd.patches['1']!])
            assert.deepStrictEqual(compilation.graph.n_1_someNode!.args, {
                args: [1234],
            })
        })
    })

    describe('_buildConnections', () => {
        const NODE_BUILDERS: NodeBuilders = {
            ...DEFAULT_NODE_BUILDERS,
            signalSourceType: {
                translateArgs: () => ({}),
                build: () => ({
                    outlets: { '0': { type: 'signal', id: '0' } },
                    inlets: {},
                }),
            },
            signalSinkType: {
                translateArgs: () => ({}),
                build: () => ({
                    outlets: {},
                    inlets: { '0': { type: 'signal', id: '0' } },
                }),
            },
            messageSourceType: {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: {},
                    outlets: { '0': { type: 'message', id: '0' } },
                }),
            },
            messageSinkType: {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: { '0': { type: 'message', id: '0' } },
                    outlets: {},
                }),
            },
        }

        it('should put a single signal connection between 2 signal portlets', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSource: {
                                type: 'signalSourceType',
                            },
                            nodeSink: {
                                type: 'signalSinkType',
                            },
                        },
                        connections: [['nodeSource', 0, 'nodeSink', 0]],
                    },
                },
            })

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders: NODE_BUILDERS,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(Object.keys(compilation.graph).sort(), [
                'n_0_nodeSink',
                'n_0_nodeSource',
            ])

            assertGraphConnections(compilation.graph, [
                ['n_0_nodeSource', '0', 'n_0_nodeSink', '0'],
            ])
        })

        it('should add mixer nodes if multiple signal connections to the same signal inlet', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSource1: {
                                type: 'signalSourceType',
                            },
                            nodeSource2: {
                                type: 'signalSourceType',
                            },
                            nodeSource3: {
                                type: 'signalSourceType',
                            },
                            nodeSink: {
                                type: 'signalSinkType',
                            },
                        },
                        connections: [
                            ['nodeSource1', 0, 'nodeSink', 0],
                            ['nodeSource2', 0, 'nodeSink', 0],
                            ['nodeSource3', 0, 'nodeSink', 0],
                        ],
                    },
                },
            })

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders: NODE_BUILDERS,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(Object.keys(compilation.graph).sort(), [
                'm_n_0_nodeSink_0__mixer',
                'n_0_nodeSink',
                'n_0_nodeSource1',
                'n_0_nodeSource2',
                'n_0_nodeSource3',
            ])

            assertGraphConnections(compilation.graph, [
                ['n_0_nodeSource1', '0', 'm_n_0_nodeSink_0__mixer', '0'],
                ['n_0_nodeSource2', '0', 'm_n_0_nodeSink_0__mixer', '1'],
                ['n_0_nodeSource3', '0', 'm_n_0_nodeSink_0__mixer', '2'],

                ['m_n_0_nodeSink_0__mixer', '0', 'n_0_nodeSink', '0'],
            ])

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSink_0__mixer']!,
                {
                    type: '_mixer~',
                    args: { channelCount: 3 },
                },
                true
            )
        })

        it('should add a sig node if no signal connection to signal inlet', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSink1: {
                                type: 'signalSinkTypeWithInitValue',
                            },
                            nodeSink2: {
                                type: 'signalSinkType',
                            },
                        },
                        connections: [],
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                ...NODE_BUILDERS,
                signalSinkTypeWithInitValue: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: { '0': { type: 'signal', id: '0' } },
                        outlets: {},
                    }),
                    configureMessageToSignalConnection() {
                        return {
                            initialSignalValue: 789,
                        }
                    },
                },
            }

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(
                Object.keys(compilation.graph).sort(),
                [
                    'n_0_nodeSink1',
                    'm_n_0_nodeSink1_0_sig',
                    'n_0_nodeSink2',
                    'm_n_0_nodeSink2_0_sig',
                ].sort()
            )

            assertGraphConnections(compilation.graph, [
                ['m_n_0_nodeSink1_0_sig', '0', 'n_0_nodeSink1', '0'],
                ['m_n_0_nodeSink2_0_sig', '0', 'n_0_nodeSink2', '0'],
            ])

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSink1_0_sig']!,
                {
                    type: 'sig~',
                    args: { initValue: 789 },
                },
                true
            )

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSink2_0_sig']!,
                {
                    type: 'sig~',
                    args: { initValue: 0 },
                },
                true
            )
        })

        it('should add a msg routing node to the sig node if message connection to signal inlet', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeMessageSource: {
                                type: 'messageSourceType'
                            },
                            nodeSignalSink: {
                                type: 'signalSinkType',
                            },
                        },
                        connections: [['nodeMessageSource', 0, 'nodeSignalSink', 0]],
                    },
                },
            })

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders: NODE_BUILDERS,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(
                Object.keys(compilation.graph).sort(),
                [
                    'n_0_nodeSignalSink',
                    'm_n_0_nodeSignalSink_0__routemsg',
                    'm_n_0_nodeSignalSink_0_sig',
                    'n_0_nodeMessageSource',
                ].sort()
            )

            assertGraphConnections(compilation.graph, [
                ['m_n_0_nodeSignalSink_0_sig', '0', 'n_0_nodeSignalSink', '0'],
                ['n_0_nodeMessageSource', '0', 'm_n_0_nodeSignalSink_0__routemsg', '0'],
                ['m_n_0_nodeSignalSink_0__routemsg', '0', 'm_n_0_nodeSignalSink_0_sig', '0'],
            ])

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSignalSink_0__routemsg']!,
                {
                    type: '_routemsg',
                    args: {},
                },
                true
            )
        })

        it('should add a msg sorting node and connect to rerouted message connection if message connection to signal inlet', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeMessageSource: {
                                type: 'messageSourceType'
                            },
                            nodeSignalSource: {
                                type: 'signalSourceType',
                            },
                            nodeSignalSink: {
                                type: 'signalSinkTypeWithMessageRerouting',
                            },
                        },
                        connections: [
                            ['nodeSignalSource', 0, 'nodeSignalSink', 0],
                            ['nodeMessageSource', 0, 'nodeSignalSink', 0],
                        ],
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                ...NODE_BUILDERS,
                signalSinkTypeWithMessageRerouting: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: { 
                            '0': { type: 'signal', id: '0' },
                            '0_message': { type: 'message', id: '0_message' },
                        },
                        outlets: {},
                    }),
                    configureMessageToSignalConnection() {
                        return {
                            reroutedMessageInletId: '0_message'
                        }
                    },
                },
            }

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(
                Object.keys(compilation.graph).sort(),
                [
                    'n_0_nodeSignalSource',
                    'n_0_nodeSignalSink',
                    'm_n_0_nodeSignalSink_0__routemsg',
                    'n_0_nodeMessageSource',
                ].sort()
            )

            assertGraphConnections(compilation.graph, [
                ['n_0_nodeSignalSource', '0', 'n_0_nodeSignalSink', '0'],
                ['n_0_nodeMessageSource', '0', 'm_n_0_nodeSignalSink_0__routemsg', '0'],
                ['m_n_0_nodeSignalSink_0__routemsg', '1', 'n_0_nodeSignalSink', '0_message'],
            ])

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSignalSink_0__routemsg']!,
                {
                    type: '_routemsg',
                    args: {},
                },
                true
            )
        })

        it('should put simple message connections between several message outlets and a message inlet', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSource1: {
                                type: 'messageSourceType',
                            },
                            nodeSource2: {
                                type: 'messageSourceType',
                            },
                            nodeSink: {
                                type: 'messageSinkType',
                            },
                        },
                        connections: [
                            ['nodeSource1', 0, 'nodeSink', 0],
                            ['nodeSource2', 0, 'nodeSink', 0],
                        ],
                    },
                },
            })

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders: NODE_BUILDERS,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(Object.keys(compilation.graph).sort(), [
                'n_0_nodeSink',
                'n_0_nodeSource1',
                'n_0_nodeSource2',
            ])
            assertNodesEqual(
                compilation.graph['n_0_nodeSink']!,
                {
                    sources: {
                        0: [
                            { nodeId: 'n_0_nodeSource1', portletId: '0' },
                            { nodeId: 'n_0_nodeSource2', portletId: '0' },
                        ],
                    },
                },
                true
            )
        })
    })
})
