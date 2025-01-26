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
import { PdJson } from '@webpd/pd-parser'
import assert from 'assert'
import { _FOR_TESTING } from '.'
import { PdGuiNode } from './types'
import { buildGraphNodeId } from '../build'
import { makePd } from '../compile-dsp-graph/test-helpers'
const {
    _discoverPdGuiRecursive,
} = _FOR_TESTING

describe('controls', () => {
    describe('_discoverPdGuiRecursive', () => {
        it('should compute proper transform function', () => {
            // ARRANGE
            const pdJson: PdJson.Pd = makePd({
                patches: {
                    0: {
                        nodes: {
                            0: {
                                type: 'bla',
                                nodeClass: 'generic',
                                args: ['some-args'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                            },
                            1: {
                                type: 'hsl',
                                nodeClass: 'control',
                                args: [11, 22, 1, 33, '', ''],
                                layout: {
                                    x: 10,
                                    y: 20,
                                    width: 25,
                                    height: 75,
                                },
                            },
                            2: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                args: ['some-args'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                                patchId: '1',
                            },
                        },
                        layout: {
                            windowX: 0,
                            windowY: 0,
                            windowWidth: 1000,
                            windowHeight: 1000,
                        },
                    },
                    1: {
                        nodes: {
                            0: {
                                type: 'bla',
                                nodeClass: 'generic',
                                args: ['some-args'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                            },
                            // Is inside viewport
                            1: {
                                type: 'vsl',
                                nodeClass: 'control',
                                args: [11, 22, 1, 33, '', ''],
                                layout: {
                                    x: 100,
                                    y: 100,
                                    width: 25,
                                    height: 150,
                                },
                            },
                            // Is outside of viewport
                            2: {
                                type: 'tgl',
                                nodeClass: 'control',
                                args: [11, 1, 22, '', ''],
                                layout: { x: 0, y: 0, size: 10 },
                            },
                            3: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                args: ['some-args'],
                                layout: {
                                    x: 112,
                                    y: 112,
                                    width: 25,
                                    height: 150,
                                },
                                patchId: '2',
                            },
                        },
                        layout: {
                            graphOnParent: 1,
                            viewportX: 100,
                            viewportY: 100,
                            viewportWidth: 25,
                            viewportHeight: 150,
                        },
                    },
                    2: {
                        nodes: {
                            0: {
                                type: 'bla',
                                nodeClass: 'generic',
                                args: ['some-args'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                            },
                            // Is inside viewport, but outside of intersection with parent viewport
                            1: {
                                type: 'hradio',
                                nodeClass: 'control',
                                args: [11, 1, 22, '', '', 0],
                                layout: {
                                    x: 80,
                                    y: 0,
                                },
                            },
                            // Is inside viewport
                            2: {
                                type: 'tgl',
                                nodeClass: 'control',
                                args: [11, 1, 22, '', ''],
                                layout: { x: 2, y: 2, size: 5 },
                            },
                            3: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                args: ['some-args'],
                                layout: {
                                    x: -1000,
                                    y: -1000,
                                    width: 0,
                                    height: 0,
                                },
                                patchId: '1',
                            },
                        },
                        layout: {
                            graphOnParent: 1,
                            viewportX: 0,
                            viewportY: 0,
                            viewportWidth: 1000,
                            viewportHeight: 1000,
                        },
                    },
                },
            })

            // ACT
            let pdGuiNodes = _discoverPdGuiRecursive(
                pdJson,
                pdJson.patches['0']
            )
            let nextControls

            // ASSERT
            // patch 0
            assert.strictEqual(pdGuiNodes.length, 2)
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[0], {
                nodeClass: 'control',
                patchId: '0',
                pdNodeId: '1',
                nodeId: buildGraphNodeId('0', '1'),
            })

            assert.ok(pdGuiNodes[1].nodeClass === 'subpatch')
            nextControls = pdGuiNodes[1].children
            pdGuiNodes[1].children = []
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[1], {
                nodeClass: 'subpatch',
                patchId: '0',
                pdNodeId: '2',
                children: [],
            })

            // subpatch 1
            pdGuiNodes = nextControls
            assert.strictEqual(pdGuiNodes.length, 2)
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[0], {
                nodeClass: 'control',
                patchId: '1',
                pdNodeId: '1',
                nodeId: buildGraphNodeId('1', '1'),
            })

            assert.ok(pdGuiNodes[1].nodeClass === 'subpatch')
            nextControls = pdGuiNodes[1].children
            pdGuiNodes[1].children = []
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[1], {
                nodeClass: 'subpatch',
                patchId: '1',
                pdNodeId: '3',
                children: [],
            })

            // subpatch 2
            pdGuiNodes = nextControls
            assert.strictEqual(pdGuiNodes.length, 1)
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[0], {
                nodeClass: 'control',
                patchId: '2',
                pdNodeId: '2',
                nodeId: buildGraphNodeId('2', '2'),
            })
        })

        it('should discover comments on the root patch', () => {
            // ARRANGE
            const pdJson: PdJson.Pd = makePd({
                patches: {
                    0: {
                        nodes: {
                            0: {
                                type: 'text',
                                nodeClass: 'text',
                                args: ['Some Comment'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                            },
                            1: {
                                type: 'pd',
                                nodeClass: 'subpatch',
                                args: ['some-args'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                                patchId: '1',
                            },
                        },
                        layout: {
                            windowX: 0,
                            windowY: 0,
                            windowWidth: 1000,
                            windowHeight: 1000,
                        },
                    },
                    1: {
                        nodes: {
                            0: {
                                type: 'text',
                                nodeClass: 'text',
                                args: ['Some Comment'],
                                layout: {
                                    x: 0,
                                    y: 0,
                                    width: 0,
                                    height: 0,
                                },
                            },
                        },
                        layout: {
                            graphOnParent: 1,
                            viewportX: 100,
                            viewportY: 100,
                            viewportWidth: 25,
                            viewportHeight: 150,
                        },
                    },
                },
            })

            // ACT
            let pdGuiNodes = _discoverPdGuiRecursive(
                pdJson,
                pdJson.patches['0']
            )
            let nextControls

            // ASSERT
            // patch 0
            assert.strictEqual(pdGuiNodes.length, 2)
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[0], {
                nodeClass: 'text',
                patchId: '0',
                pdNodeId: '0',
            })

            assert.ok(pdGuiNodes[1].nodeClass === 'subpatch')
            nextControls = pdGuiNodes[1].children
            pdGuiNodes[1].children = []
            assert.deepStrictEqual<PdGuiNode>(pdGuiNodes[1], {
                nodeClass: 'subpatch',
                patchId: '0',
                pdNodeId: '1',
                children: [],
            })

            // subpatch 1
            pdGuiNodes = nextControls
            assert.strictEqual(pdGuiNodes.length, 0)
        })
    })
})
