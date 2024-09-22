import { DspGraph, CompilationSettings } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import { buildGraphNodeId } from '../../../compile-dsp-graph/to-dsp-graph'
import { NodeArguments as SendReceiveNodeArguments } from '../../../nodes/nodes/send-receive'

export interface IoMessageSpecMetadataSendReceive {
    group: 'send' | 'receive'
    name: string
    position: [number, number]
}

export const collectIoMessageReceiversFromSendNodes = (
    pdJson: PdJson.Pd,
    graph: DspGraph.Graph
) =>
    _collectNodes(pdJson, graph, 'send').reduce(
        (messageReceivers, [pdNode, node]) => ({
            ...messageReceivers,
            [node.id]: {
                portletIds: ['0'],
                metadata: _buildIoMetadata(pdNode, node) as any,
            },
        }),
        {} as CompilationSettings['io']['messageReceivers']
    )

export const collectIoMessageSendersFromReceiveNodes = (
    pdJson: PdJson.Pd,
    graph: DspGraph.Graph
) =>
    _collectNodes(pdJson, graph, 'receive').reduce(
        (messageSenders, [pdNode, node]) => ({
            ...messageSenders,
            [node.id]: {
                portletIds: ['0'],
                metadata: _buildIoMetadata(pdNode, node) as any,
            },
        }),
        {} as CompilationSettings['io']['messageSenders']
    )

const _collectNodes = (
    pdJson: PdJson.Pd,
    graph: DspGraph.Graph,
    pdNodeType: 'send' | 'receive'
) => {
    const rootPatch = pdJson.patches[pdJson.rootPatchId]
    return Object.values(rootPatch.nodes)
        .map((pdNode) => {
            const nodeId = buildGraphNodeId(rootPatch.id, pdNode.id)
            const node = graph[nodeId]
            if (
                pdNode.type === pdNodeType &&
                // Important because some nodes are deleted at dsp-graph compilation.
                // and if we declare messageReceivers for them it will cause error.
                // TODO : maybe the compiler should detect this instead of doing it here ?
                !!node
            ) {
                return [pdNode, node] as [PdJson.Node, DspGraph.Node]
            } else {
                return null
            }
        })
        .filter((pair) => pair !== null)
}

const _buildIoMetadata = (pdNode: PdJson.Node, node: DspGraph.Node) => {
    const layout = pdNode.layout || {}
    return {
        group: node.type as 'send' | 'receive',
        name: (node.args as SendReceiveNodeArguments).busName,
        position:
            layout.x !== undefined && layout.y !== undefined
                ? [layout.x, layout.y]
                : undefined,
    } as IoMessageSpecMetadataSendReceive
}
