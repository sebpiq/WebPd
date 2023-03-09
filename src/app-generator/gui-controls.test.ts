import { PdJson } from '@webpd/pd-parser'
import { makePd } from '@webpd/pd-parser/src/test-helpers'
import assert from 'assert'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    isPointInsideRectangle,
    _discoverGuiControlsRecursive,
} from './gui-controls'

describe('math-utils', () => {
    describe('models', () => {
        describe('_discoverGuiControlsRecursive', () => {
            it('should compute proper transform function', () => {
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

                let controls = _discoverGuiControlsRecursive(
                    pdJson,
                    pdJson.patches['0']
                )
                let nextControls

                // patch 0
                assert.strictEqual(controls.length, 2)
                assert.deepStrictEqual(controls[0], {
                    type: 'control',
                    patch: pdJson.patches['0'],
                    node: pdJson.patches['0'].nodes['1'],
                })

                assert.ok(controls[1].type === 'container')
                nextControls = controls[1].children
                delete controls[1].children
                assert.deepStrictEqual(controls[1], {
                    type: 'container',
                    patch: pdJson.patches['0'],
                    node: pdJson.patches['0'].nodes['2'],
                })

                // subpatch 1
                controls = nextControls
                assert.strictEqual(controls.length, 2)
                assert.deepStrictEqual(controls[0], {
                    type: 'control',
                    patch: pdJson.patches['1'],
                    node: pdJson.patches['1'].nodes['1'],
                })

                assert.ok(controls[1].type === 'container')
                nextControls = controls[1].children
                delete controls[1].children
                assert.deepStrictEqual(controls[1], {
                    type: 'container',
                    patch: pdJson.patches['1'],
                    node: pdJson.patches['1'].nodes['3'],
                })

                // subpatch 2
                controls = nextControls
                assert.strictEqual(controls.length, 1)
                assert.deepStrictEqual(controls[0], {
                    type: 'control',
                    patch: pdJson.patches['2'],
                    node: pdJson.patches['2'].nodes['2'],
                })
            })
        })
    })

    describe('makeTranslationTransform', () => {
        it('should compute proper transform function', () => {
            const transform = makeTranslationTransform(
                { x: 1, y: 2 },
                { x: 10, y: -4 }
            )
            assert.deepStrictEqual(transform({ x: 0, y: 0 }), { x: 9, y: -6 })
            assert.deepStrictEqual(transform({ x: 10, y: 1 }), { x: 19, y: -5 })
        })
    })

    describe('isPointInsideRectangle', () => {
        it('should return true if point is inside rectangle', () => {
            assert.strictEqual(
                isPointInsideRectangle(
                    { x: 9, y: 2.5 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                true
            )
        })

        it('should return false if point is outside rectangle', () => {
            assert.strictEqual(
                isPointInsideRectangle(
                    { x: 19, y: 2.5 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                false
            )
        })

        it('should return true if point is on rectangle border', () => {
            assert.strictEqual(
                isPointInsideRectangle(
                    { x: 9, y: 13 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                true
            )
        })
    })

    describe('computeRectanglesIntersection', () => {
        it('should compute intersection for simple intersecting rectangles', () => {
            assert.deepStrictEqual(
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 15, y: 16 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 10, y: 13 },
                }
            )
        })

        it('should compute intersection for one rectangle inside the other', () => {
            assert.deepStrictEqual(
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 9, y: 13 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 9, y: 13 },
                }
            )
        })

        it('should work with infinity rectangle', () => {
            assert.deepStrictEqual(
                computeRectanglesIntersection(
                    {
                        topLeft: { x: -Infinity, y: -Infinity },
                        bottomRight: { x: Infinity, y: Infinity },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 9, y: 13 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 9, y: 13 },
                }
            )
        })

        it('should compute empty intersection for disjoint rectangles', () => {
            assert.deepStrictEqual(
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 11, y: 13 },
                        bottomRight: { x: 15, y: 19 },
                    }
                ),
                null
            )
        })
    })
})
