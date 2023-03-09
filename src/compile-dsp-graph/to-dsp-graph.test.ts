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

import assert from 'assert'
import toDspGraph, {
    Compilation,
    _buildNodes,
    _buildConnections,
} from './to-dsp-graph'
import {
    assertGraphConnections,
    assertGraphsEqual,
    assertNodesEqual,
} from '@webpd/compiler-js/src/dsp-graph/test-helpers'
import { NodeBuilders } from './types'
import { nodeBuilders as subpatchNodeBuilders } from '../nodes/nodes/subpatch'
import { builder as mixerNodeBuilder } from '../nodes/nodes/mixer~'
import { DspGraph } from '@webpd/compiler-js'
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
    'mixer~': mixerNodeBuilder,
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
            'osc~': {
                translateArgs: () => ({}),
                build: () => ({
                    inlets: {
                        '0': { type: 'signal', id: '0' },
                        '0_message': { type: 'message', id: '0' },
                    },
                    outlets: { '0': { type: 'signal', id: '0' } },
                }),
                rerouteMessageConnection: (inletId) => {
                    if (inletId === '0') {
                        return '0_message'
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
                            osc: { type: 'osc~' },
                        },
                        connections: [['inletNode', 0, 'osc', 0]],
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
                    n_1_osc: {},
                },
                true
            )
            assertGraphConnections(graph, [
                ['n_0_msg', '0', 'n_1_osc', '0_message'],
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
                            osc: { type: 'osc~' },
                        },
                        connections: [['spNode', 0, 'osc', 0]],
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
                    n_0_osc: {},
                },
                true
            )
            assertGraphConnections(graph, [
                ['n_1_msg', '0', 'n_0_osc', '0_message'],
            ])
        })

        it('should be able to handle multiple connections from one subpatch to another', async () => {
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
                            osc2: {
                                type: 'osc~',
                            },
                            osc3: {
                                type: 'osc~',
                            },
                        },
                        connections: [
                            ['osc2', 0, 'outlet1', 0],
                            ['osc3', 0, 'outlet2', 0],
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
                            osc1: {
                                type: 'osc~',
                            },
                        },
                        connections: [['inlet1', 0, 'osc1', 0]],
                        inlets: ['inlet1'],
                        outlets: [],
                    },
                },
            })

            const compilationResult = await toDspGraph(pd, NODE_BUILDERS)
            assert.ok(compilationResult.status === 0)
            const { graph } = compilationResult

            assertGraphConnections(graph, [
                ['n_1_osc2', '0', 'm_n_2_osc1_0', '0'],
                ['n_1_osc3', '0', 'm_n_2_osc1_0', '1'],
                ['m_n_2_osc1_0', '0', 'n_2_osc1', '0'],
            ])
        })

        it('should handle several signal connections, one local, one from parent', async () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        isRoot: true,
                        nodes: {
                            '0': {
                                type: 'osc~',
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
                            '1': { type: 'osc~' },
                            '2': { type: 'osc~' },
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
                ['n_0_0', '0', 'm_n_1_2_0', '0'],
                ['n_1_1', '0', 'm_n_1_2_0', '1'],
                ['m_n_1_2_0', '0', 'n_1_2', '0'],
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
            const { graph } = compilationResult

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

            const { abstractionsLoadingErrors, abstractionsLoadingWarnings } = compilationResult
            assert.deepStrictEqual(abstractionsLoadingErrors, {
                unknownNodeType: {
                    unknownNodeType: 'unknownNodeType',
                },
                typeWithParsingErrors: {
                    parsingErrors: [
                        { message: 'some error', lineIndex: 666 },
                    ],
                },
            })

            assert.deepStrictEqual(abstractionsLoadingWarnings, {
                typeWithParsingErrors: [
                    { message: 'some warning', lineIndex: 999 },
                ]
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
        it('should build the basic connections from a pd json object', () => {
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
            _buildConnections(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!, pd.patches['1']!])

            assertGraphConnections(compilation.graph, [
                ['n_1_n1', '0', 'n_0_n2', '0'],
            ])
        })

        it('should add mixer nodes if several signal connections to the same sink', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSource1: {
                                type: 'signalType',
                            },
                            nodeSource2: {
                                type: 'signalType',
                            },
                            nodeSource3: {
                                type: 'signalType',
                            },
                            nodeSink: {
                                type: 'signalType',
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

            const nodeBuilders: NodeBuilders = {
                ...DEFAULT_NODE_BUILDERS,
                signalType: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: { '0': { type: 'signal', id: '0' } },
                        outlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'signal', id: '1' },
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
            _buildConnections(compilation, [pd.patches['0']!])

            assert.deepStrictEqual(Object.keys(compilation.graph).sort(), [
                'm_n_0_nodeSink_0',
                'n_0_nodeSink',
                'n_0_nodeSource1',
                'n_0_nodeSource2',
                'n_0_nodeSource3',
            ])

            assertNodesEqual(
                compilation.graph['m_n_0_nodeSink_0']!,
                {
                    args: { channelCount: 3 },
                    sources: {
                        0: [{ nodeId: 'n_0_nodeSource1', portletId: '0' }],
                        1: [{ nodeId: 'n_0_nodeSource2', portletId: '0' }],
                        2: [{ nodeId: 'n_0_nodeSource3', portletId: '0' }],
                    },
                    sinks: {
                        0: [{ nodeId: 'n_0_nodeSink', portletId: '0' }],
                    },
                    inlets: {
                        '0': {
                            id: '0',
                            type: 'signal',
                        },
                        '1': {
                            id: '1',
                            type: 'signal',
                        },
                        '2': {
                            id: '2',
                            type: 'signal',
                        },
                    },
                    outlets: {
                        '0': {
                            id: '0',
                            type: 'signal',
                        },
                    },
                },
                true
            )
        })

        it('should connect directly nodes if several message connections to the same sink', () => {
            const pd: PdJson.Pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            nodeSource1: {
                                type: 'controlType',
                            },
                            nodeSource2: {
                                type: 'controlType',
                            },
                            nodeSink: {
                                type: 'controlType',
                            },
                        },
                        connections: [
                            ['nodeSource1', 0, 'nodeSink', 0],
                            ['nodeSource2', 0, 'nodeSink', 0],
                        ],
                    },
                },
            })

            const nodeBuilders: NodeBuilders = {
                ...DEFAULT_NODE_BUILDERS,
                controlType: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: { '0': { type: 'message', id: '0' } },
                        outlets: { '0': { type: 'message', id: '0' } },
                    }),
                },
            }

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
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

        it('should replace sink if the node builder defines rerouteMessageConnection', async () => {
            const nodeBuilders: NodeBuilders = {
                ...DEFAULT_NODE_BUILDERS,
                someType: {
                    translateArgs: () => ({}),
                    build: () => ({
                        inlets: {
                            '0': { type: 'signal', id: '0' },
                            '1': { type: 'message', id: '1' },
                            '10': { type: 'message', id: '10' },
                        },
                        outlets: { '0': { type: 'message', id: '0' } },
                    }),
                    rerouteMessageConnection: (inletId: DspGraph.PortletId) => {
                        if (inletId === '0') {
                            return '10'
                        }
                        return undefined
                    },
                },
            }

            const pd = makePd({
                patches: {
                    '0': {
                        nodes: {
                            n1: {
                                type: 'someType',
                            },
                            n2: {
                                type: 'someType',
                            },
                        },
                        connections: [
                            // rerouteMessageConnection should be re-routing that connection
                            ['n1', 0, 'n2', 0],
                            // ... but not that one
                            ['n1', 0, 'n2', 1],
                        ],
                    },
                },
            })

            const compilation: Compilation = {
                ...makeDefaultCompilation(),
                pd,
                nodeBuilders,
            }

            _buildNodes(compilation, [pd.patches['0']!])
            _buildConnections(compilation, [pd.patches['0']!])

            assertGraphConnections(compilation.graph, [
                ['n_0_n1', '0', 'n_0_n2', '10'],
                ['n_0_n1', '0', 'n_0_n2', '1'],
            ])
        })
    })
})
