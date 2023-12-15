import { DspGraph, CompilationSettings } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import { ControlTree, traverseGuiControls } from './gui-controls'
import { buildGraphNodeId } from '../compile-dsp-graph/to-dsp-graph'
import { NodeArguments } from '../nodes/nodes/send-receive'
import { builders } from '../nodes/nodes/controls-float'

const FLOAT_CONTROL_TYPES = Object.keys(builders)

interface IoMessageSpecMetadataControlBase {
    group: string
    type: PdJson.NodeType
    position: [number, number]
    label?: string
}

interface IoMessageSpecMetadataControlFloat
    extends IoMessageSpecMetadataControlBase {
    group: 'control:float'
    initValue: number
    minValue: number
    maxValue: number
}

interface IoMessageSpecMetadataControl
    extends IoMessageSpecMetadataControlBase {
    group: 'control'
}

interface IoMessageSpecMetadataSend {
    group: 'send'
    name: string
    position: [number, number]
}

export type IoMessageSpecMetadata =
    | IoMessageSpecMetadataControl
    | IoMessageSpecMetadataControlFloat
    | IoMessageSpecMetadataSend

export const collectIoMessageReceiversFromSendNodes = (
    pdJson: PdJson.Pd,
    graph: DspGraph.Graph
) => {
    const rootPatch = pdJson.patches[pdJson.rootPatchId]
    const messageReceivers: CompilationSettings['io']['messageReceivers'] = {}
    Object.values(rootPatch.nodes).forEach((pdNode) => {
        const nodeId = buildGraphNodeId(rootPatch.id, pdNode.id)
        const node = graph[nodeId]
        if (
            pdNode.type === 'send' &&
            // Important because some nodes are deleted at dsp-graph compilation.
            // and if we declare messageReceivers for them it will cause error.
            // TODO : maybe the compiler should detect this instead of doing it here ?
            !!node
        ) {
            if (!messageReceivers[nodeId]) {
                const layout = pdNode.layout || {}
                const metadata: IoMessageSpecMetadataSend = {
                    group: 'send',
                    name: (node.args as NodeArguments).busName,
                    position:
                        layout.x !== undefined && layout.y !== undefined
                            ? [layout.x, layout.y]
                            : undefined,
                }
                messageReceivers[nodeId] = {
                    portletIds: [],
                    metadata: metadata as any,
                }
            }
            messageReceivers[nodeId].portletIds.push('0')
        }
    })

    return messageReceivers
}

export const collectIoMessageReceiversFromGui = (
    controls: Array<ControlTree>,
    graph: DspGraph.Graph
) => {
    const messageReceivers: CompilationSettings['io']['messageReceivers'] = {}
    traverseGuiControls(controls, (control) => {
        const portletId = '0'
        const nodeId = buildGraphNodeId(control.patch.id, control.node.id)

        if (!messageReceivers[nodeId]) {
            const node = graph[nodeId]
            // Important because some nodes are deleted at dsp-graph compilation.
            // and if we declare messageReceivers for them it will cause error.
            // TODO : maybe the compiler should detect this instead of doing it here ?
            if (!node) {
                return
            }
            const layout = control.node.layout || {}
            let metadata: IoMessageSpecMetadataControl | IoMessageSpecMetadataControlFloat = {
                group: 'control',
                type: control.node.type,
                label: (layout as any).label,
                position:
                    layout.x !== undefined && layout.y !== undefined
                        ? [layout.x, layout.y]
                        : undefined,
            }
    
            if (FLOAT_CONTROL_TYPES.includes(control.node.type)) {
                metadata = {
                    ...metadata,
                    group: 'control:float',
                    initValue: node.args.initValue,
                    minValue: node.args.minValue,
                    maxValue: node.args.maxValue,
                }
            }
    
            messageReceivers[nodeId] = {
                portletIds: [],
                metadata: metadata as any,
            }
        }
        messageReceivers[nodeId].portletIds.push(portletId)
    })
    return messageReceivers
}
