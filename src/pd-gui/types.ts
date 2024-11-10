/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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
import { PdJson } from "@webpd/pd-parser"

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
    children: Array<ControlTreeNode>
}

export type ControlTreeNode = Control | ControlContainer

export interface Comment {
    type: 'comment'
    patch: PdJson.Patch
    node: PdJson.Node
    text: string
}