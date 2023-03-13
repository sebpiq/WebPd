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
import { SharedCodeGenerator } from "@webpd/compiler/src/types";
import { interpolateLin } from "./points";

export const linesUtils: Array<SharedCodeGenerator> = [...interpolateLin, ({ macros: { Var, Func }}) => `

    class LineSegment {
        ${Var('p0', 'Point')}
        ${Var('p1', 'Point')}
        ${Var('dx', 'Float')}
        ${Var('dy', 'Float')}
    }

    function computeSlope ${Func([
        Var('p0', 'Point'),
        Var('p1', 'Point'),
    ], 'Float')} {
        return p1.x !== p0.x ? (p1.y - p0.y) / (p1.x - p0.x) : 0
    }

    function removePointsBeforeFrame ${Func([
        Var('points', 'Array<Point>'),
        Var('frame', 'Float'),
    ], 'Array<Point>')} {
        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        while (i < points.length) {
            if (frame <= points[i].x) {
                newPoints.push(points[i])
            }
            i++
        }
        return newPoints
    }

    function insertNewLinePoints ${Func([
        Var('points', 'Array<Point>'),
        Var('p0', 'Point'),
        Var('p1', 'Point'),
    ], 'Array<Point>')} {
        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        
        // Keep the points that are before the new points added
        while (i < points.length && points[i].x <= p0.x) {
            newPoints.push(points[i])
            i++
        }
        
        // Find the start value of the start point :
        
        // 1. If there is a previous point and that previous point
        // is on the same frame, we don't modify the start point value.
        // (represents a vertical line).
        if (0 < i - 1 && points[i - 1].x === p0.x) {

        // 2. If new points are inserted in between already existing points 
        // we need to interpolate the existing line to find the startValue.
        } else if (0 < i && i < points.length) {
            newPoints.push({
                x: p0.x,
                y: interpolateLin(p0.x, points[i - 1], points[i])
            })

        // 3. If new line is inserted after all existing points, 
        // we just take the value of the last point
        } else if (i >= points.length && points.length) {
            newPoints.push({
                x: p0.x,
                y: points[points.length - 1].y,
            })

        // 4. If new line placed in first position, we take the defaultStartValue.
        } else if (i === 0) {
            newPoints.push({
                x: p0.x,
                y: p0.y,
            })
        }
        
        newPoints.push({
            x: p1.x,
            y: p1.y,
        })
        return newPoints
    }

    function computeFrameAjustedPoints ${Func([
        Var('points', 'Array<Point>'),
    ], 'Array<Point>')} {
        if (points.length < 2) {
            throw new Error('invalid length for points')
        }

        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        let ${Var('p', 'Point')} = points[0]
        let ${Var('frameLower', 'Float')} = 0
        let ${Var('frameUpper', 'Float')} = 0
        
        while(i < points.length) {
            p = points[i]
            frameLower = Math.floor(p.x)
            frameUpper = frameLower + 1

            // I. Placing interpolated point at the lower bound of the current frame
            // ------------------------------------------------------------------------
            // 1. Point is already on an exact frame,
            if (p.x === frameLower) {
                newPoints.push({ x: p.x, y: p.y })

                // 1.a. if several of the next points are also on the same X,
                // we find the last one to draw a vertical line.
                while (
                    (i + 1) < points.length
                    && points[i + 1].x === frameLower
                ) {
                    i++
                }
                if (points[i].y !== newPoints[newPoints.length - 1].y) {
                    newPoints.push({ x: points[i].x, y: points[i].y })
                }

                // 1.b. if last point, we quit
                if (i + 1 >= points.length) {
                    break
                }

                // 1.c. if next point is in a different frame we can move on to next iteration
                if (frameUpper <= points[i + 1].x) {
                    i++
                    continue
                }
            
            // 2. Point isn't on an exact frame
            // 2.a. There's a previous point, the we use it to interpolate the value.
            } else if (newPoints.length) {
                newPoints.push({
                    x: frameLower,
                    y: interpolateLin(frameLower, points[i - 1], p),
                })
            
            // 2.b. It's the very first point, then we don't change its value.
            } else {
                newPoints.push({ x: frameLower, y: p.y })
            }

            // II. Placing interpolated point at the upper bound of the current frame
            // ---------------------------------------------------------------------------
            // First, we find the closest point from the frame upper bound (could be the same p).
            // Or could be a point that is exactly placed on frameUpper.
            while (
                (i + 1) < points.length 
                && (
                    Math.ceil(points[i + 1].x) === frameUpper
                    || Math.floor(points[i + 1].x) === frameUpper
                )
            ) {
                i++
            }
            p = points[i]

            // 1. If the next point is directly in the next frame, 
            // we do nothing, as this corresponds with next iteration frameLower.
            if (Math.floor(p.x) === frameUpper) {
                continue
            
            // 2. If there's still a point after p, we use it to interpolate the value
            } else if (i < points.length - 1) {
                newPoints.push({
                    x: frameUpper,
                    y: interpolateLin(frameUpper, p, points[i + 1]),
                })

            // 3. If it's the last point, we dont change the value
            } else {
                newPoints.push({ x: frameUpper, y: p.y })
            }

            i++
        }

        return newPoints
    }

    function computeLineSegments ${Func([
        Var('points', 'Array<Point>'),
    ], 'Array<LineSegment>')} {
        const ${Var('lineSegments', 'Array<LineSegment>')} = []
        let ${Var('i', 'Int')} = 0
        let ${Var('p0', 'Point')}
        let ${Var('p1', 'Point')}

        while(i < points.length - 1) {
            p0 = points[i]
            p1 = points[i + 1]
            lineSegments.push({
                p0, p1, 
                dy: computeSlope(p0, p1),
                dx: 1,
            })
            i++
        }
        return lineSegments
    }

`]
