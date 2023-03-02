/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { DspGraph } from '@webpd/compiler-js'
import { PdJson } from '@webpd/pd-parser'

// Patch translation PdJson -> DspGraph
export interface PartialNode {
    inlets: DspGraph.Node['inlets']
    outlets: DspGraph.Node['outlets']
    isPullingSignal?: DspGraph.Node['isPullingSignal']
    isPushingMessages?: DspGraph.Node['isPushingMessages']
}

export interface NodeBuilder<NodeArgsType> {
    /**
     * Translate Pd node arguments into node arguments for DspGraph.
     * @returns A structured map of arguments for the node,
     * where arguments are all type-checked and are always assigned a
     * default value.
     */
    translateArgs: (
        pdNode: PdJson.Node,
        patch: PdJson.Patch,
        pd: PdJson.Pd
    ) => NodeArgsType

    /**
     * Builds a partial node from DspGraph node arguments.
     * Most importantly this allows to declare node's `inlets` and `outlets`,
     */
    build: (nodeArgs: NodeArgsType) => PartialNode

    /**
     * In Pd, messages can be connected to signal inlets. We forbid this in the dsp-graph,
     * therefore this hook is provided to reroute incoming message connections to a node
     * to a different inlet.
     */
    rerouteMessageConnection?: (
        inletId: DspGraph.PortletId
    ) => DspGraph.PortletId | undefined

    skipDollarArgsResolution?: true
    aliasTo?: undefined
    isNoop?: undefined
}

export interface NodeBuilderAlias {
    isNoop?: undefined

    /** Declares that this node builder is just an alias for another node builder. */
    aliasTo: PdJson.NodeType
}

export interface NodeBuilderNoop {
    aliasTo?: undefined

    /** Declares that this node type is a noop and should be removed from the graph. */
    isNoop: true
}

export interface NodeBuilders {
    [nodeType: PdJson.NodeType]:
        | NodeBuilder<any>
        | NodeBuilderAlias
        | NodeBuilderNoop
}
