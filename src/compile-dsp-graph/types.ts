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

import { DspGraph } from '@webpd/compiler'
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
