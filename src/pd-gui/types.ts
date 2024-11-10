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