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
import { CompilationSettings, DspGraph } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import {
    collectIoMessageReceiversFromSendNodes,
    collectIoMessageSendersFromReceiveNodes,
} from './send-receive'
import {
    collectIoMessageReceiversFromGui,
    collectIoMessageSendersFromGui,
} from './pd-gui'
import { discoverPdGui, traversePdGui } from '../../../pd-gui'
import { WebPdMetadata } from '../../types'

export const applySettingsDefaults = <UserMetadata>(
    settings: CompilationSettings<UserMetadata>,
    graph: DspGraph.Graph,
    pd?: PdJson.Pd
): CompilationSettings<UserMetadata & WebPdMetadata> => {
    const webPdMetadata: WebPdMetadata = {
        pdNodes: {},
        graph: {},
        pdGui: [],
    }

    const io = settings.io || {}

    // If io.messageReceivers / io.messageSenders are not defined, we infer them by
    // discovering UI controls and [send] / [receive] nodes and generating
    // messageReceivers / messageSenders for each one.
    if (!io.messageReceivers) {
        io.messageReceivers = {
            ...collectIoMessageReceiversFromGui(pd, graph),
            ...collectIoMessageReceiversFromSendNodes(pd, graph),
        }
    }

    if (!io.messageSenders) {
        io.messageSenders = {
            ...collectIoMessageSendersFromGui(pd, graph),
            ...collectIoMessageSendersFromReceiveNodes(pd, graph),
        }
    }

    Object.keys(io.messageReceivers).forEach((nodeId) => {
        webPdMetadata.graph[nodeId] = graph[nodeId]
    })

    Object.keys(io.messageSenders).forEach((nodeId) => {
        webPdMetadata.graph[nodeId] = graph[nodeId]
    })

    if (pd) {
        const pdGui = discoverPdGui(pd)
        traversePdGui(pdGui, (pdGuiNode) => {
            // Add pd node to customMetadata
            // We keep both controls and subpatches
            webPdMetadata.pdNodes[pdGuiNode.patchId] =
                webPdMetadata.pdNodes[pdGuiNode.patchId] || {}
            webPdMetadata.pdNodes[pdGuiNode.patchId][pdGuiNode.pdNodeId] =
                pd.patches[pdGuiNode.patchId].nodes[pdGuiNode.pdNodeId]
            
            // Add dsp graph node to customMetadata
            // Keep only controls, because subpatches are not part of the dsp graph
            if (pdGuiNode.nodeClass === 'control') {
                const node = graph[pdGuiNode.nodeId]
                if (node) {
                    webPdMetadata.graph[pdGuiNode.nodeId] = node
                }
            }
        })
        webPdMetadata.pdGui = pdGui
    }

    return {
        ...settings,
        io,
        customMetadata: {
            ...(settings.customMetadata || {}),
            ...webPdMetadata,
        },
    } as CompilationSettings<WebPdMetadata & UserMetadata>
}
