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
import { DspGraph, CompilationSettings } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import { buildGraphNodeId } from '../../../../compile-dsp-graph/to-dsp-graph'
import { discoverGuiControls, traverseGuiControls } from './gui-controls'
import { builders } from '../../../../nodes/nodes/controls-float'

const FLOAT_CONTROL_TYPES = [...Object.keys(builders), 'floatatom']

interface IoMessageSpecMetadataControlBase {
    group: string
    type: PdJson.NodeType
    position: [number, number]
    label?: string
}

export interface IoMessageSpecMetadataControlFloat
    extends IoMessageSpecMetadataControlBase {
    group: 'control:float'
    initValue: number
    minValue: number
    maxValue: number
}

export interface IoMessageSpecMetadataControl
    extends IoMessageSpecMetadataControlBase {
    group: 'control'
}

export const collectIoMessageReceiversFromGui = (
    pd: PdJson.Pd,
    graph: DspGraph.Graph
) =>
    _collectNodes(pd, graph).reduce(
        (messageReceivers, [pdNode, node]) => ({
            ...messageReceivers,
            [node.id]: {
                portletIds: ['0'],
                metadata: _buildIoMetadata(pdNode, node) as any,
            },
        }),
        {} as CompilationSettings['io']['messageReceivers']
    )

export const collectIoMessageSendersFromGui = (
    pd: PdJson.Pd,
    graph: DspGraph.Graph
) =>
    _collectNodes(pd, graph).reduce(
        (messageSenders, [pdNode, node]) => ({
            ...messageSenders,
            [node.id]: {
                portletIds: ['0'],
                metadata: _buildIoMetadata(pdNode, node) as any,
            },
        }),
        {} as CompilationSettings['io']['messageSenders']
    )

const _collectNodes = (pdJson: PdJson.Pd, graph: DspGraph.Graph) => {
    const { controls } = discoverGuiControls(pdJson)
    const nodePairs: Array<[PdJson.ControlNode, DspGraph.Node]> = []
    traverseGuiControls(controls, (control) => {
        const nodeId = buildGraphNodeId(control.patch.id, control.node.id)
        const node = graph[nodeId]
        // Important because some nodes are deleted at dsp-graph compilation.
        // and if we declare messageReceivers for them it will cause error.
        // TODO : maybe the compiler should detect this instead of doing it here ?
        if (node) {
            nodePairs.push([control.node, node])
        }
    })
    return nodePairs
}

const _buildIoMetadata = (pdNode: PdJson.ControlNode, node: DspGraph.Node) => {
    const layout = pdNode.layout || {}
    let metadata:
        | IoMessageSpecMetadataControl
        | IoMessageSpecMetadataControlFloat = {
        group: 'control',
        type: pdNode.type,
        label: (layout as any).label,
        position:
            layout.x !== undefined && layout.y !== undefined
                ? [layout.x, layout.y]
                : undefined,
    }

    if (FLOAT_CONTROL_TYPES.includes(pdNode.type)) {
        metadata = {
            ...metadata,
            group: 'control:float',
            initValue: node.args.initValue,
            minValue: node.args.minValue,
            maxValue: node.args.maxValue,
        }
    }
    return metadata
}
