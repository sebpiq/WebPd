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

import { linesUtils } from './lines'
import { 
    testHelpers, 
    stdlib, 
    AnonFunc, 
    ConstVar, 
    Func, 
    Sequence, 
    Var, 
    GlobalDefinitions,
} from '@webpd/compiler'
import { point } from './points'
import { initializeTests } from '../test-helpers'
initializeTests()

const lineTestUtils: GlobalDefinitions = {
    namespace: 'lineTestUtils',
    // prettier-ignore
    code: ({ ns: lineTestUtils }, { points, linesUtils }) => Sequence([
        Func(lineTestUtils.round, [
            Var(`Float`, `val`), 
            Var(`Float`, `decimal`)
        ], 'Float')`
            return Math.round(val * Math.pow(10, decimal)) / Math.pow(10, decimal)
        `,

        Func(lineTestUtils.assert_pointsArraysEqual, [
            Var(`Array<${points.Point}>`, `actual`), 
            Var(`Array<${points.Point}>`, `expected`)
        ], 'void')`
            if (actual.length !== expected.length) {
                reportTestFailure(
                    'Got point array of length ' + actual.length.toString() 
                    + ' expected ' + expected.length.toString())
            }

            for (${Var(`Int`, `i`, `0`)}; i < actual.length; i++) {
                if (
                    ${lineTestUtils.round}(actual[i].x, 5) !== ${lineTestUtils.round}(expected[i].x, 5)
                    || ${lineTestUtils.round}(actual[i].y, 5) !== ${lineTestUtils.round}(expected[i].y, 5)
                ) {
                    reportTestFailure(
                        'Point ' + i.toString() 
                        + ', expected {x: ' + expected[i].x.toString() + ', y: ' + expected[i].y.toString() + '}'
                        + ', got {x: ' + actual[i].x.toString() + ', y: ' + actual[i].y.toString() + '}'
                    )
                }
            }
        `,

        Func(lineTestUtils.assert_linesArraysEqual, [
            Var(`Array<${linesUtils.LineSegment}>`, `actual`), 
            Var(`Array<${linesUtils.LineSegment}>`, `expected`)
        ], 'void')`
            if (actual.length !== expected.length) {
                reportTestFailure(
                    'Got point array of length ' + actual.length.toString() 
                    + ' expected ' + expected.length.toString())
            }

            for (${Var(`Int`, `i`, `0`)}; i < actual.length; i++) {
                if (
                    ${lineTestUtils.round}(actual[i].p0.x, 5) !== ${lineTestUtils.round}(expected[i].p0.x, 5)
                    || ${lineTestUtils.round}(actual[i].p0.y, 5) !== ${lineTestUtils.round}(expected[i].p0.y, 5)
                    || ${lineTestUtils.round}(actual[i].p1.x, 5) !== ${lineTestUtils.round}(expected[i].p1.x, 5)
                    || ${lineTestUtils.round}(actual[i].p1.y, 5) !== ${lineTestUtils.round}(expected[i].p1.y, 5)
                    || ${lineTestUtils.round}(actual[i].dx, 5) !== ${lineTestUtils.round}(expected[i].dx, 5)
                    || ${lineTestUtils.round}(actual[i].dy, 5) !== ${lineTestUtils.round}(expected[i].dy, 5)
                ) {
                    reportTestFailure(
                        'LineSegment ' + i.toString() 
                        + ', got p0 [' + actual[i].p0.x.toString() + ', ' + actual[i].p0.y.toString() + ']'
                        + ' ; p1 [' + actual[i].p1.x.toString() + ', ' + actual[i].p1.y.toString() + ']'
                    )
                }
            }
        `
    ]),
    dependencies: [ point, linesUtils ]
}

describe('global-code.lines', () => {
    testHelpers.runTestSuite(
        [
            {
                description:
                    'insertNewLinePoints > should remove points that are after the newly inserted line and interpolate y %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 100, y: 0}, 
                        {x: 200, y: 0.5}
                    ]`)}
                    const newPoints = ${linesUtils.insertNewLinePoints}(
                        points,
                        {x: 150, y: 0.1},
                        {x: 300, y: 2},
                    )
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 100, y: 0}, 
                            {x: 150, y: 0.25}, 
                            {x: 300, y: 2}
                        ]
                    )
                `,
            },

            {
                description: 'insertNewLinePoints > should add points at the end if no collision and use end value from previous point %s',
                testFunction: ({ globals: { lineTestUtils, points, linesUtils } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 100, y: 0}, 
                        {x: 200, y: 1}
                    ]`)}
                    const newPoints = ${linesUtils.insertNewLinePoints}(
                        points,
                        {x: 250, y: -1},
                        {x: 300, y: 2},
                    )
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 100, y: 0}, 
                            {x: 200, y: 1}, 
                            {x: 250, y: 1}, 
                            {x: 300, y: 2}, 
                        ]
                    )
                `
            },

            {
                description: 'insertNewLinePoints > should use start value if inserting at the beginning %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 100, y: 0}, 
                        {x: 200, y: 0.5}
                    ]`)}
                    const newPoints = ${linesUtils.insertNewLinePoints}(
                        points,
                        {x: 50, y: 0.15},
                        {x: 300, y: 2}, 
                    )
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 50, y: 0.15}, 
                            {x: 300, y: 2}, 
                        ]
                    )
                `
            },

            {
                description: 'insertNewLinePoints > should insert points in an empty list %s',
                testFunction: ({ globals: { lineTestUtils, points, linesUtils } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[]`)}
                    const newPoints = ${linesUtils.insertNewLinePoints}(
                        points,
                        {x: 150, y: 0.1},
                        {x: 300, y: 2}, 
                    )
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 150, y: 0.1}, 
                            {x: 300, y: 2}, 
                        ]
                    )
                `
            },

            {
                description: 'insertNewLinePoints > should not replace points on the start frame %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 100, y: 0}, 
                        {x: 100, y: 8}
                    ]`)}
                    const newPoints = ${linesUtils.insertNewLinePoints}(
                        points,
                        {x: 100, y: 28},
                        {x: 300, y: 30}, 
                    )
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 100, y: 0}, 
                            {x: 100, y: 8}, 
                            {x: 300, y: 30}, 
                        ]
                    )
                `
            },

            {
                description: 'removePointsBeforeFrame > should remove points that are after the newly inserted line and interpolate y %s',
                testFunction: ({ globals: { linesUtils, lineTestUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 90, y: 1}, 
                        {x: 100, y: 1.25}, 
                        {x: 101, y: -56.5}
                    ]`)}
                    const newPoints = ${linesUtils.removePointsBeforeFrame}(points, 100)
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        newPoints, 
                        [
                            {x: 100, y: 1.25}, 
                            {x: 101, y: -56.5}, 
                        ]
                    )
                `
            },

            {
                description: 'computeFrameAjustedPoints > should not change the points if already frame adjusted %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 0, y: 1}, 
                        {x: 100, y: 1.25}, 
                        {x: 101, y: -56.5}
                    ]`)}
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        ${linesUtils.computeFrameAjustedPoints}(points),
                        [
                            {x: 0, y: 1}, 
                            {x: 100, y: 1.25}, 
                            {x: 101, y: -56.5}, 
                        ]
                    )
        
                `
            },

            {
                description: 'computeFrameAjustedPoints > should adjust the points separated by several frames %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 0.5, y: 0}, 
                        {x: 10.5, y: 10}
                    ]`)}
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        ${linesUtils.computeFrameAjustedPoints}(points),
                        [
                            {x: 0, y: 0}, 
                            {x: 1, y: 0.5}, 
                            {x: 10, y: 9.5}, 
                            {x: 11, y: 10}, 
                        ]
                    )
                `
            },

            {
                description: 'computeFrameAjustedPoints > should adjust multiple points that are in the middle of their frames %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 100.25, y: 0}, 
                        {x: 200.25, y: 100000}, 
                        {x: 250.25, y: 200000}
                    ]`)}
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        ${linesUtils.computeFrameAjustedPoints}(points),
                        [
                            {x: 100, y: 0},
                            {x: 101, y: (0.75 / 100) * 100000},
                            {x: 200, y: (99.75 / 100) * 100000},
                            {x: 201, y: 100000 + (0.75 / 50) * 100000},
                            {x: 250, y: 100000 + (49.75 / 50) * 100000},
                            {x: 251, y: 200000},
                        ]
                    )
                `
            },

            {
                description: 'computeFrameAjustedPoints > should compute multi segment from points that are all within a single frame %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 0, y: 0}, 
                        {x: 0.1, y: 100}, 
                        {x: 0.3, y: 600}, 
                        {x: 0.8, y: 4700}, 
                        {x: 1.8, y: 5700}, 
                        {x: 1.9, y: 5800}, 
                        {x: 2, y: 9000}, 
                    ]`)}
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        ${linesUtils.computeFrameAjustedPoints}(points),
                        [
                            {x: 0, y: 0}, 
                            {x: 1, y: 4900}, 
                            {x: 2, y: 9000}, 
                        ]
                    )
                `
            },

            {
                description: 'computeFrameAjustedPoints > should handle vertical lines on exact frame fine %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils, points } }) => AnonFunc()`
                    ${ConstVar(`Array<${points.Point}>`, `points`, `[
                        {x: 1, y: 1}, 
                        {x: 1, y: 4}, 
                        {x: 1, y: 5}, 
                        {x: 1, y: 10}, 
                        {x: 101, y: 11}, 
                        {x: 101, y: 15}, 
                        {x: 101, y: 20}, 
                        {x: 102, y: 0}, 
                        {x: 102, y: -10}, 
                    ]`)}
                    ${lineTestUtils.assert_pointsArraysEqual}(
                        ${linesUtils.computeFrameAjustedPoints}(points),
                        [
                            {x: 1, y: 1}, 
                            {x: 1, y: 10}, 
                            {x: 101, y: 11}, 
                            {x: 101, y: 20}, 
                            {x: 102, y: 0}, 
                            {x: 102, y: -10}, 
                        ]
                    )
                `
            },

            {
                description: 'computeLineSegments > should compute simple line segment from two points on exact frames %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils } }) => AnonFunc()`
                    ${lineTestUtils.assert_linesArraysEqual}(
                        ${linesUtils.computeLineSegments}([
                            {x: 100, y: 0}, 
                            {x: 200, y: 5}, 
                            {x: 201, y: 4}, 
                            {x: 301, y: 3}, 
                            {x: 302, y: 3}, 
                        ]),
                        [
                            {
                                p0: {x: 100, y: 0},
                                p1: {x: 200, y: 5},
                                dy: 0.05,
                                dx: 1,
                            },
                            {
                                p0: {x: 200, y: 5},
                                p1: {x: 201, y: 4},
                                dx: 1,
                                dy: -1,
                            },
                            {
                                p0: {x: 201, y: 4},
                                p1: {x: 301, y: 3},
                                dx: 1,
                                dy: -1 / 100,
                            },
                            {
                                p0: {x: 301, y: 3},
                                p1: {x: 302, y: 3},
                                dx: 1,
                                dy: 0,
                            }

                        ]
                    )
                `
            },

            {
                description: 'computeLineSegments > should compute slope = 0 if same x %s',
                testFunction: ({ globals: { lineTestUtils, linesUtils } }) => AnonFunc()`
                    ${lineTestUtils.assert_linesArraysEqual}(
                        ${linesUtils.computeLineSegments}([
                            {x: 100, y: 0}, 
                            {x: 100, y: 5}, 
                        ]),
                        [
                            {
                                p0: {x: 100, y: 0}, 
                                p1: {x: 100, y: 5}, 
                                dx: 1,
                                dy: 0
                            }
                        ]
                    )
                `
            },

        ],
        [stdlib.core, linesUtils, lineTestUtils]
    )
})
