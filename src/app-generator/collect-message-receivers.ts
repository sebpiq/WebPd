import { DspGraph, CompilationSettings } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import {
    ControlTree,
    traverseGuiControls,
} from './gui-controls'
import { buildGraphNodeId } from '../compile-dsp-graph/to-dsp-graph'
import { NodeArguments } from '../nodes/nodes/send-receive'

interface IoMessageSpecMetadataGui {
    group: 'gui'
    type: PdJson.NodeType
    args: PdJson.Node['args']
    position: [number, number]
    label?: string
}

interface IoMessageSpecMetadataSend {
    group: 'send'
    name: string
    position: [number, number]
}

export type IoMessageSpecMetadata = IoMessageSpecMetadataGui | IoMessageSpecMetadataSend

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
            const layout = pdNode.layout || {}
            const metadata: IoMessageSpecMetadataSend = {
                group: 'send',
                name: (node.args as NodeArguments).busName,
                position:
                    layout.x !== undefined && layout.y !== undefined
                        ? [layout.x, layout.y]
                        : undefined,
            }
            messageReceivers[nodeId] = messageReceivers[nodeId] || {
                portletIds: [],
                metadata: metadata as any,
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
        const nodeId = buildGraphNodeId(control.patch.id, control.node.id)
        const portletId = '0'
        // Important because some nodes are deleted at dsp-graph compilation.
        // and if we declare messageReceivers for them it will cause error.
        // TODO : maybe the compiler should detect this instead of doing it here ?
        if (!graph[nodeId]) {
            return
        }
        const layout = control.node.layout || {}
        const metadata: IoMessageSpecMetadataGui = {
            group: 'gui',
            type: control.node.type,
            label: (layout as any).label,
            position:
                layout.x !== undefined && layout.y !== undefined
                    ? [layout.x, layout.y]
                    : undefined,
            args: control.node.args,
        }
        messageReceivers[nodeId] = messageReceivers[nodeId] || {
            portletIds: [],
            metadata: metadata as any,
        }
        messageReceivers[nodeId].portletIds.push(portletId)
    })
    return messageReceivers
}