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
