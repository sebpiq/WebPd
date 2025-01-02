import assert from "assert"
import { computeRectanglesIntersection, isPointInsideRectangle, makeTranslationTransform } from "./geometry"

describe('geometry', () => {
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
