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
import { _buildNodes, _buildConnections } from './to-dsp-graph'
import { pdJsonNodeDefaults, makePd } from '@webpd/pd-parser/src/test-helpers'
import { NodeBuilders } from './types'
import instantiateAbstractions from './instantiate-abstractions'
import { PdJson } from '@webpd/pd-parser'

const DUMMY_NODE_TYPE = pdJsonNodeDefaults('').type

const NODE_BUILDERS: NodeBuilders = {
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

describe('instantiateAbstractions', () => {
    it('should recursively resolve and instantiate abstractions', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'abstract1', args: [123] },
                        n2: { type: 'abstract2', args: ['hello'] },
                        array1: {
                            type: 'array',
                            nodeClass: 'array',
                            arrayId: '0',
                        },
                    },
                },
            },
            arrays: {
                '0': {
                    args: ['$0-bla', 100, 0],
                },
            },
        })

        const abstract1: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'abstract2', args: ['blabla'] },
                    },
                },
            },
        })

        const abstract2: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: {},
                        array1: {
                            type: 'array',
                            nodeClass: 'array',
                            arrayId: '0',
                        },
                    },
                },
            },
            arrays: {
                '0': {
                    args: ['$0-blo', 100, 0],
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => {
                switch (nodeType) {
                    case 'abstract1':
                        return { status: 0, pd: abstract1 }
                    case 'abstract2':
                        return { status: 0, pd: abstract2 }
                    default:
                        return { status: 1, unknownNodeType: nodeType }
                }
            }
        )

        assert.ok(results.status === 0)
        const {
            pd: pdWithResolvedAbstractions,
            rootPatch,
            abstractions,
        } = results

        assert.deepStrictEqual(Object.keys(rootPatch.nodes).sort(), [
            'array1',
            'n1',
            'n2',
        ])
        assert.deepStrictEqual<PdJson.Pd>(
            pdWithResolvedAbstractions,
            makePd({
                patches: {
                    '0': {
                        nodes: {
                            n1: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                                args: [123],
                            },
                            n2: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '3',
                                args: ['hello'],
                            },
                            array1: {
                                type: 'array',
                                nodeClass: 'array',
                                arrayId: '0',
                            },
                        },
                    },
                    // [abstract1] inside main patch
                    '1': {
                        args: [123],
                        nodes: {
                            n1: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '2',
                                args: ['blabla'],
                            },
                        },
                    },
                    // [abstract2] inside main patch's [abstract1]
                    '2': {
                        args: ['blabla'],
                        nodes: {
                            n1: {},
                            array1: {
                                type: 'array',
                                nodeClass: 'array',
                                arrayId: '1',
                            },
                        },
                    },
                    // [abstract2] inside main patch
                    '3': {
                        args: ['hello'],
                        nodes: {
                            n1: {},
                            array1: {
                                type: 'array',
                                nodeClass: 'array',
                                arrayId: '2',
                            },
                        },
                    },
                },
                arrays: {
                    '0': { args: ['0-bla', 100, 0] },
                    '1': { args: ['2-blo', 100, 0] },
                    '2': { args: ['3-blo', 100, 0] },
                },
            })
        )

        assert.deepStrictEqual(abstractions, {
            abstract1,
            abstract2,
        })
    })

    it('should work with abstractions and subpatches', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'abstract1' },
                        n2: { type: 'pd', nodeClass: 'subpatch', patchId: '1' },
                    },
                },
                '1': {
                    isRoot: false,
                    nodes: {
                        n3: { type: 'pd', nodeClass: 'subpatch', patchId: '2' },
                    },
                },
                '2': {
                    isRoot: false,
                    nodes: {
                        n4: {},
                    },
                },
            },
        })

        const abstract1: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n5: {},
                    },
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => {
                switch (nodeType) {
                    case 'abstract1':
                        return { status: 0, pd: abstract1 }
                    default:
                        return { status: 1, unknownNodeType: nodeType }
                }
            }
        )

        assert.ok(results.status === 0)
        const { pd: pdWithResolvedAbstractions } = results

        assert.deepStrictEqual<PdJson.Pd>(
            pdWithResolvedAbstractions,
            makePd({
                patches: {
                    '0': {
                        nodes: {
                            n1: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '3',
                            },
                            n2: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '1',
                            },
                        },
                    },
                    '1': {
                        isRoot: false,
                        nodes: {
                            n3: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                patchId: '2',
                            },
                        },
                    },
                    '2': {
                        isRoot: false,
                        nodes: {
                            n4: {},
                        },
                    },
                    '3': {
                        isRoot: true,
                        args: [],
                        nodes: {
                            n5: {},
                        },
                    },
                },
            })
        )
    })

    it('should resolve array name and size', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'abstract1', args: [666, 22] },
                    },
                },
            },
        })

        const abstract1: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        array1: {
                            type: 'array',
                            nodeClass: 'array',
                            arrayId: '0',
                        },
                    },
                },
            },
            arrays: {
                '0': {
                    args: ['$1-bla', '$2', 0],
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => {
                switch (nodeType) {
                    case 'abstract1':
                        return { status: 0, pd: abstract1 }
                    default:
                        return { status: 1, unknownNodeType: nodeType }
                }
            }
        )
        assert.ok(results.status === 0)
        const { pd: pdWithResolvedAbstractions } = results

        assert.deepStrictEqual<PdJson.Pd['arrays']>(
            pdWithResolvedAbstractions.arrays,
            {
                '0': {
                    id: '0',
                    data: null,
                    args: ['666-bla', 22, 0],
                    layout: {},
                },
            }
        )
    })

    it('should return node types that failed resolving', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'unknownNodeType1' },
                        n2: { type: 'pd', nodeClass: 'subpatch', patchId: '1' },
                    },
                },
                '1': {
                    isRoot: false,
                    nodes: {
                        n1: { type: 'unknownNodeType2' },
                    },
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => ({ status: 1, unknownNodeType: nodeType })
        )
        assert.ok(results.status === 1)

        assert.deepStrictEqual(results.errors, {
            unknownNodeType1: {
                unknownNodeType: 'unknownNodeType1',
            },
            unknownNodeType2: {
                unknownNodeType: 'unknownNodeType2',
            },
        })
    })

    it('should return warnings even when resolution succeeded', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'nodeTypeWithWarnings1' },
                        n2: { type: 'pd', nodeClass: 'subpatch', patchId: '1' },
                    },
                },
                '1': {
                    isRoot: false,
                    nodes: {
                        n1: { type: 'nodeTypeWithWarnings2' },
                        n2: { type: 'nodeTypeWithWarnings2' },
                    },
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => ({
                status: 0,
                pd: makePd({
                    patches: {
                        '0': {
                            isRoot: true,
                        },
                    },
                }),
                parsingWarnings: [
                    {
                        message: `parsing node ${nodeType} warning line 42`,
                        lineIndex: 42,
                    },
                ],
            })
        )
        assert.ok(results.status === 0)

        assert.deepStrictEqual(results.warnings, {
            nodeTypeWithWarnings1: [
                {
                    message: `parsing node nodeTypeWithWarnings1 warning line 42`,
                    lineIndex: 42,
                },
            ],
            nodeTypeWithWarnings2: [
                {
                    message: `parsing node nodeTypeWithWarnings2 warning line 42`,
                    lineIndex: 42,
                },
            ],
        })
    })

    it('should return parsing errors and warnings', async () => {
        const pd: PdJson.Pd = makePd({
            patches: {
                '0': {
                    isRoot: true,
                    nodes: {
                        n1: { type: 'nodeTypeWithErrors1' },
                        n2: { type: 'pd', nodeClass: 'subpatch', patchId: '1' },
                    },
                },
                '1': {
                    isRoot: false,
                    nodes: {
                        n1: { type: 'nodeTypeWithErrors2' },
                    },
                },
            },
        })

        const results = await instantiateAbstractions(
            pd,
            NODE_BUILDERS,
            async (nodeType) => ({
                status: 1,
                parsingErrors: [
                    {
                        message: `parsing node ${nodeType} error line 1`,
                        lineIndex: 1,
                    },
                    {
                        message: `parsing node ${nodeType} error line 2`,
                        lineIndex: 2,
                    },
                ],
                parsingWarnings: [
                    {
                        message: `parsing node ${nodeType} warning line 42`,
                        lineIndex: 42,
                    },
                ],
            })
        )
        assert.ok(results.status === 1)

        assert.deepStrictEqual(results.warnings, {
            nodeTypeWithErrors1: [
                {
                    message: `parsing node nodeTypeWithErrors1 warning line 42`,
                    lineIndex: 42,
                },
            ],
            nodeTypeWithErrors2: [
                {
                    message: `parsing node nodeTypeWithErrors2 warning line 42`,
                    lineIndex: 42,
                },
            ],
        })

        assert.deepStrictEqual(results.errors, {
            nodeTypeWithErrors1: {
                parsingErrors: [
                    {
                        message: `parsing node nodeTypeWithErrors1 error line 1`,
                        lineIndex: 1,
                    },
                    {
                        message: `parsing node nodeTypeWithErrors1 error line 2`,
                        lineIndex: 2,
                    },
                ],
            },
            nodeTypeWithErrors2: {
                parsingErrors: [
                    {
                        message: `parsing node nodeTypeWithErrors2 error line 1`,
                        lineIndex: 1,
                    },
                    {
                        message: `parsing node nodeTypeWithErrors2 error line 2`,
                        lineIndex: 2,
                    },
                ],
            },
        })
    })
})
