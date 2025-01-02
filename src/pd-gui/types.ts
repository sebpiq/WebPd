import { DspGraph } from "@webpd/compiler"
import { PdJson } from "@webpd/pd-parser"

export interface Point {
    x: number
    y: number
}

export interface Rectangle {
    topLeft: Point
    bottomRight: Point
}

interface PdGuiNodeBase {
    patchId: PdJson.GlobalId
    pdNodeId: PdJson.LocalId
    nodeClass: PdJson.Node['nodeClass']
}

export interface PdGuiControl extends PdGuiNodeBase {
    nodeClass: 'control'
    nodeId: DspGraph.NodeId
}

export interface PdGuiSubpatch extends PdGuiNodeBase {
    nodeClass: 'subpatch'
    children: Array<PdGuiNode>
}

export interface PdGuiComment extends PdGuiNodeBase {
    nodeClass: 'text'
}

export type PdGuiNode = PdGuiControl | PdGuiSubpatch | PdGuiComment
