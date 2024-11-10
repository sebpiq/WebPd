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
import { CompilationSettings, DspGraph, CustomMetadata } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import {
    collectIoMessageReceiversFromSendNodes,
    collectIoMessageSendersFromReceiveNodes,
    SendReceiveMetadata,
} from './send-receive'
import {
    collectIoMessageReceiversFromGui,
    collectIoMessageSendersFromGui,
    GuiControlMetadata,
} from './pd-gui-controls'

export interface IoMetadata extends CustomMetadata {
    messageReceivers?: Array<GuiControlMetadata | SendReceiveMetadata>
    messageSenders?: Array<GuiControlMetadata | SendReceiveMetadata>
}

export const buildIoSettingsDefaults = (
    settings: CompilationSettings,
    graph: DspGraph.Graph,
    pd: PdJson.Pd
): CompilationSettings => {
    const io = settings.io || {}
    const customMetadata: IoMetadata = settings.customMetadata || {}
    // If io.messageReceivers / io.messageSenders are not defined, we infer them by
    // discovering UI controls and [send] / [receive] nodes and generating
    // messageReceivers / messageSenders for each one.
    if (!io.messageReceivers) {
        const [ioMessageReceiversFromGui, customMetadataFromGui] =
            collectIoMessageReceiversFromGui(pd, graph)
        const [ioMessageReceiversFromSendNodes, customMetadataFromSendNodes] =
            collectIoMessageReceiversFromSendNodes(pd, graph)
        io.messageReceivers = {
            ...ioMessageReceiversFromGui,
            ...ioMessageReceiversFromSendNodes,
        }
        customMetadata.messageReceivers = [
            ...customMetadataFromGui,
            ...customMetadataFromSendNodes,
        ]
    }

    if (!io.messageSenders) {
        const [ioMessageSendersFromGui, customMetadataFromGui] =
            collectIoMessageSendersFromGui(pd, graph)
        const [
            ioMessageSendersFromReceiveNodes,
            customMetadataFromReceiveNodes,
        ] = collectIoMessageSendersFromReceiveNodes(pd, graph)
        io.messageSenders = {
            ...ioMessageSendersFromGui,
            ...ioMessageSendersFromReceiveNodes,
        }
        customMetadata.messageSenders = [
            ...customMetadataFromGui,
            ...customMetadataFromReceiveNodes,
        ]
    }

    return {
        ...settings,
        io: {
            messageReceivers: {},
            messageSenders: {},
            ...io,
        },
        customMetadata: customMetadata as CustomMetadata,
    }
}
