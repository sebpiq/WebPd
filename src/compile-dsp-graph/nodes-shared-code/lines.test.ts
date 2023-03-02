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

import { getMacros } from '@webpd/compiler-js/src/compile'
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import assert from 'assert'
import { linesUtils } from './lines'
import {
    NodeImplementationTestParameters,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from './test-helpers'

describe('nodes-shared-code.lines', () => {
    const generateTestBindings = async ({
        target,
        bitDepth,
        floatArrayType,
    }: NodeImplementationTestParameters) => {
        const macros = getMacros(target)
        const { Var, Func } = macros
        const code =
            linesUtils.map((codeGen) => codeGen({ macros })).join('\n') +
            `
            function testCreatePoint ${Func(
                [Var('x', 'Float'), Var('y', 'Float')],
                'Point'
            )} {
                return { x, y }
            }

            function testCreatePointArray ${Func(
                [Var('array', 'FloatArray')],
                'Array<Point>'
            )} {
                const ${Var('points', 'Array<Point>')} = []
                for (let ${Var('i', 'Int')} = 0; i < array.length; i += 2) {
                    points.push({ x: array[i], y: array[i + 1] })
                }
                return points
            }

            function testReadPointArray ${Func(
                [Var('points', 'Array<Point>')],
                'FloatArray'
            )} {
                const ${Var(
                    'array',
                    'FloatArray'
                )} = createFloatArray(points.length * 2)
                for (let ${Var('i', 'Int')} = 0; i < points.length; i++) {
                    array[2 * i] = points[i].x
                    array[2 * i + 1] = points[i].y
                }
                return array
            }

            function testReadLineSegmentArray ${Func(
                [Var('lineSegments', 'Array<LineSegment>')],
                'FloatArray'
            )} {
                const ${Var(
                    'array',
                    'FloatArray'
                )} = createFloatArray(lineSegments.length * 5)
                for (let ${Var('i', 'Int')} = 0; i < lineSegments.length; i++) {
                    array[5 * i] = lineSegments[i].p0.x
                    array[5 * i + 1] = lineSegments[i].p0.y
                    array[5 * i + 2] = lineSegments[i].p1.x
                    array[5 * i + 3] = lineSegments[i].p1.y
                    array[5 * i + 4] = lineSegments[i].dy
                }
                return array
            }
            
        `

        return await nodeImplementationsTestHelpers.createTestBindings(
            code,
            target,
            bitDepth,
            {
                insertNewLinePoints: 0,
                removePointsBeforeFrame: 0,
                computeFrameAjustedPoints: 0,
                computeLineSegments: 0,
                testCreatePoint: 0,
                testCreatePointArray: 0,
                testReadPointArray: new floatArrayType(0),
                testReadLineSegmentArray: new floatArrayType(0),
            }
        )
    }

    describe('insertNewLinePoints', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should remove points that are after the newly inserted line and interpolate y %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([100, 0, 200, 0.5])
                )
                const newPoints = b.insertNewLinePoints(
                    points,
                    b.testCreatePoint(150, 0.1),
                    b.testCreatePoint(300, 2),
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([100, 0, 150, 0.25, 300, 2])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should add points at the end if no collision and use end value from previous point %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([100, 0, 200, 1])
                )
                const newPoints = b.insertNewLinePoints(
                    points,
                    b.testCreatePoint(250, -1),
                    b.testCreatePoint(300, 2),
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([100, 0, 200, 1, 250, 1, 300, 2])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should use start value if inserting at the beginning %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([100, 0, 200, 0.5])
                )
                const newPoints = b.insertNewLinePoints(
                    points,
                    b.testCreatePoint(50, 0.15),
                    b.testCreatePoint(300, 2),
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([50, 0.15, 300, 2])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should insert points in an empty list %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([])
                )
                const newPoints = b.insertNewLinePoints(
                    points,
                    b.testCreatePoint(150, 0.1),
                    b.testCreatePoint(300, 2),
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([150, 0.1, 300, 2])
                )
            }
        )


        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should not replace points on the start frame %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([100, 0, 100, 8])
                )
                const newPoints = b.insertNewLinePoints(
                    points,
                    b.testCreatePoint(100, 28),
                    b.testCreatePoint(300, 30),
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([
                        100, 0,
                        100, 8,
                        300, 30,
                    ])
                )
            }
        )
    })

    describe('removePointsBeforeFrame', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should remove points that are after the newly inserted line and interpolate y %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        90, 1,
                        100, 1.25, 
                        101, -56.5,
                    ])
                )
                const newPoints = b.removePointsBeforeFrame(
                    points,
                    100
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(newPoints),
                    new floatArrayType([
                        100, 1.25, 
                        101, -56.5,
                    ])
                )
            }
        )
    })

    describe('computeFrameAjustedPoints', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should not change the points if already frame adjusted %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        0, 1, 
                        100, 1.25, 
                        101, -56.5,
                    ])
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(b.computeFrameAjustedPoints(points)),
                    new floatArrayType([
                        0, 1, 
                        100, 1.25, 
                        101, -56.5,
                    ])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should adjust the points separated by several frames %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        0.5, 0, 
                        10.5, 10,
                    ])
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(b.computeFrameAjustedPoints(points)),
                    new floatArrayType([
                        0, 0, 
                        1, 0.5,
                        10, 9.5,
                        11, 10,
                    ])
                )
            }
        )


        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should adjust multiple points that are in the middle of their frames %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        100.25, 0, 
                        200.25, 100000, 
                        250.25, 200000,
                    ])
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(b.computeFrameAjustedPoints(points)),
                    new floatArrayType([
                        100, 0,
                        101, 0.75 / 100 * 100000,
                        200, 99.75 / 100 * 100000,
                        201, 100000 + 0.75 / 50 * 100000,
                        250, 100000 + 49.75 / 50 * 100000,
                        251, 200000,
                    ])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should compute multi segment from points that are all within a single frame %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        0, 0, 
                        0.1, 100, 
                        0.3, 600,
                        0.8, 4700,
                        1.8, 5700,
                        1.9, 5800,
                        2, 9000,
                    ])
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(b.computeFrameAjustedPoints(points)),
                    new floatArrayType([
                        0, 0, 
                        1, 4900,
                        2, 9000,
                    ])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should handle vertical lines on exact frame fine %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const points = b.testCreatePointArray(
                    new floatArrayType([
                        1, 1, 
                        1, 4,
                        1, 5,
                        1, 10, 
                        101, 11,
                        101, 15,
                        101, 20,
                        102, 0,
                        102, -10,
                    ])
                )
                assert.deepStrictEqual(
                    b.testReadPointArray(b.computeFrameAjustedPoints(points)),
                    new floatArrayType([
                        1, 1, 
                        1, 10,
                        101, 11,
                        101, 20,
                        102, 0,
                        102, -10,
                    ])
                )
            }
        )

    })

    describe('computeLineSegments', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should compute simple line segment from two points on exact frames %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const lineSegments = b.computeLineSegments(
                    b.testCreatePointArray(
                        new floatArrayType([
                            100, 0, 
                            200, 5, 
                            201, 4, 
                            301, 3, 
                            302, 3
                        ])
                    )
                )
                assert.deepStrictEqual(
                    b.testReadLineSegmentArray(lineSegments),
                    new floatArrayType([
                        100, 0, 200, 5, 0.05,
                        200, 5, 201, 4, -1,
                        201, 4, 301, 3, -1 / 100,
                        301, 3, 302, 3, 0
                    ])
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should compute slope = 0 if same x %s',
            async (testParams) => {
                const { floatArrayType } = testParams
                const b = await generateTestBindings(testParams)
                const lineSegments = b.computeLineSegments(
                    b.testCreatePointArray(
                        new floatArrayType([
                            100, 0, 
                            100, 5, 
                        ])
                    )
                )
                assert.deepStrictEqual(
                    b.testReadLineSegmentArray(lineSegments),
                    new floatArrayType([
                        100, 0, 100, 5, 0,
                    ])
                )
            }
        )
    })
})
