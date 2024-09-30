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
    IoMessageSpecMetadataSendReceive,
} from './send-receive'
import {
    collectIoMessageReceiversFromGui,
    collectIoMessageSendersFromGui,
    IoMessageSpecMetadataControl,
    IoMessageSpecMetadataControlFloat,
} from './gui-controls'

export type IoMessageSpecMetadata =
    | IoMessageSpecMetadataControl
    | IoMessageSpecMetadataControlFloat
    | IoMessageSpecMetadataSendReceive

export const applyIoDefaults = (
    io: CompilationSettings['io'],
    graph: DspGraph.Graph,
    pd: PdJson.Pd
) => {
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

    return {
        messageReceivers: {},
        messageSenders: {},
        ...io,
    }
}
