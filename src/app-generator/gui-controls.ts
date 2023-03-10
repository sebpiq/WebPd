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
import { CompilationSettings, DspGraph } from '@webpd/compiler-js'
import { CONTROL_TYPE, PdJson } from '@webpd/pd-parser'
import { buildGraphNodeId } from '../compile-dsp-graph/to-dsp-graph'

export interface Point {
    x: number
    y: number
}

export interface Rectangle {
    topLeft: Point
    bottomRight: Point
}

export interface Control {
    type: 'control'
    patch: PdJson.Patch
    node: PdJson.ControlNode
}

export interface ControlContainer {
    type: 'container'
    patch: PdJson.Patch
    node: PdJson.Node
    children: Array<ControlTree>
}

export type ControlTree = Control | ControlContainer

export interface Comment {
    type: 'comment'
    patch: PdJson.Patch
    node: PdJson.Node
    text: string
}

export const getPdNode = (
    pdJson: PdJson.Pd,
    [patchId, nodeId]: [PdJson.GlobalId, PdJson.LocalId]
) => pdJson.patches[patchId].nodes[nodeId]

export const discoverGuiControls = (
    pdJson: PdJson.Pd,
    rootPatch: PdJson.Patch
) => ({
    controls: _discoverGuiControlsRecursive(pdJson, rootPatch),
    comments: Object.values(rootPatch.nodes)
        .filter((node) => node.type === 'text')
        .map((node) => {
            const comment: Comment = {
                type: 'comment',
                patch: rootPatch,
                node,
                text: node.args[0]!.toString(),
            }
            return comment
        }),
})

export const _discoverGuiControlsRecursive = (
    pdJson: PdJson.Pd,
    patch: PdJson.Patch,
    viewport: Rectangle | null = null
): Array<Control | ControlContainer> => {
    if (viewport === null) {
        viewport = {
            topLeft: { x: -Infinity, y: -Infinity },
            bottomRight: { x: Infinity, y: Infinity },
        }
    }

    const controls: Array<Control | ControlContainer> = []
    Object.values(patch.nodes).forEach((node) => {
        if (node.type === 'pd' && node.nodeClass === 'subpatch') {
            const subpatch = pdJson!.patches[node.patchId]
            const nodeLayout = _assertNodeLayout(node.layout)

            if (!subpatch.layout!.graphOnParent) {
                return
            }

            const subpatchLayout = _assertPatchLayout(subpatch.layout)

            // 1. we convert all coordinates to the subpatch coords system
            const toSubpatchCoords = makeTranslationTransform(
                { x: nodeLayout.x, y: nodeLayout.y },
                { x: subpatchLayout.viewportX, y: subpatchLayout.viewportY }
            )
            const parentViewport = {
                topLeft: toSubpatchCoords(viewport!.topLeft),
                bottomRight: toSubpatchCoords(viewport!.bottomRight),
            }

            const topLeft = {
                x: subpatchLayout.viewportX,
                y: subpatchLayout.viewportY,
            }
            const subpatchViewport = {
                topLeft,
                bottomRight: sumPoints(topLeft, {
                    x: subpatchLayout.viewportWidth,
                    y: subpatchLayout.viewportHeight,
                }),
            }

            // 2. we compute the visible intersection in the subpatch coords system
            // and call the function for the subpatch
            const visibleSubpatchViewport = computeRectanglesIntersection(
                parentViewport,
                subpatchViewport
            )

            if (visibleSubpatchViewport === null) {
                return
            }

            const children = _discoverGuiControlsRecursive(
                pdJson,
                subpatch,
                visibleSubpatchViewport
            )

            const control: ControlContainer = {
                type: 'container',
                patch,
                node,
                children,
            }
            controls.push(control)

            // 3. When we get ab actual control node, we see if it is inside the
            // visible viewport (which was previously transformed to local coords).
        } else if (node.type in CONTROL_TYPE && node.nodeClass === 'control') {
            const nodeLayout = _assertNodeLayout(node.layout)
            if (
                !isPointInsideRectangle(
                    {
                        x: nodeLayout.x,
                        y: nodeLayout.y,
                    },
                    viewport!
                )
            ) {
                return
            }

            const control: Control = {
                type: 'control',
                patch,
                node,
            }

            controls.push(control)
        }
    })
    return controls
}

export const traverseGuiControls = (controls: Array<ControlTree>, func: (control: Control) => void) => {
    controls.forEach((control) => {
        if (control.type === 'container') {
            traverseGuiControls(
                control.children,
                func
            )
        } else if (control.type === 'control') {
            func(control)
        }
    })    
}

export const collectGuiControlsInletCallerSpecs = (
    controls: Array<ControlTree>,
    graph: DspGraph.Graph,
) => {
    const inletCallerSpecs: CompilationSettings['inletCallerSpecs'] = {}
    traverseGuiControls(controls, (control) => {
        const nodeId = buildGraphNodeId(
            control.patch.id,
            control.node.id
        )
        const portletId = '0'
        // Important because some nodes are deleted at dsp-graph compilation.
        // and if we declare inletCallerSpec for them it will cause error.
        // TODO : maybe the compiler should detect this instead of doing it here ?
        if (!graph[nodeId]) {
            return
        }
        inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || []
        inletCallerSpecs[nodeId].push(portletId)
    })
    return inletCallerSpecs
}

export const makeTranslationTransform = (fromPoint: Point, toPoint: Point) => {
    const xOffset = toPoint.x - fromPoint.x
    const yOffset = toPoint.y - fromPoint.y
    return (fromPoint: Point) => {
        return {
            x: fromPoint.x + xOffset,
            y: fromPoint.y + yOffset,
        }
    }
}

export const sumPoints = (p1: Point, p2: Point) => ({
    x: p1.x + p2.x,
    y: p1.y + p2.y,
})

export const computeRectanglesIntersection = (r1: Rectangle, r2: Rectangle) => {
    const topLeft = {
        x: Math.max(r1.topLeft.x, r2.topLeft.x),
        y: Math.max(r1.topLeft.y, r2.topLeft.y),
    }
    const bottomRight = {
        x: Math.min(r1.bottomRight.x, r2.bottomRight.x),
        y: Math.min(r1.bottomRight.y, r2.bottomRight.y),
    }
    if (bottomRight.x <= topLeft.x || bottomRight.y <= topLeft.y) {
        return null
    } else {
        return { topLeft, bottomRight }
    }
}

export const isPointInsideRectangle = (p: Point, r: Rectangle) =>
    r.topLeft.x <= p.x &&
    p.x <= r.bottomRight.x &&
    r.topLeft.y <= p.y &&
    p.y <= r.bottomRight.y

const _assertNodeLayout = (layout: PdJson.Node['layout']) => {
    if (!layout) {
        throw new Error(`Missing node layout`)
    }
    const x = layout.x
    const y = layout.y
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error(`Missing node layout attributes`)
    }
    return {
        x,
        y,
    }
}

const _assertPatchLayout = (layout: PdJson.Patch['layout']) => {
    if (!layout) {
        throw new Error(`Missing patch layout`)
    }
    const viewportX = layout.viewportX
    const viewportY = layout.viewportY
    const viewportWidth = layout.viewportWidth
    const viewportHeight = layout.viewportHeight
    if (
        typeof viewportX !== 'number' ||
        typeof viewportY !== 'number' ||
        typeof viewportWidth !== 'number' ||
        typeof viewportHeight !== 'number'
    ) {
        debugger
        throw new Error(`Missing patch layout attributes`)
    }
    return {
        viewportX,
        viewportY,
        viewportWidth,
        viewportHeight,
    }
}