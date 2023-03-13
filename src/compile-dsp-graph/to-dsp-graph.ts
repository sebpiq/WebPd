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

import { NodeBuilders } from './types'
import {
    resolveNodeType,
    resolvePatch,
    resolvePdNode,
    resolvePdNodeDollarArgs,
} from './compile-helpers'
import instantiateAbstractions, {
    AbstractionLoader,
    AbstractionsLoadingErrors,
    AbstractionsLoadingWarnings,
} from './instantiate-abstractions'
import { nodeBuilders as subpatchNodeBuilders } from '../nodes/nodes/subpatch'
import { DspGraph, dspGraph } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'

export const MIXER_NODE_TYPE = 'mixer~'

enum IdNamespaces {
    PD = 'n',
    MIXER = 'm',
}

type PatchPath = Array<PdJson.Patch>

type PdGlobEndpoint = [PatchPath, PdJson.ConnectionEndpoint]

type PdGlobConnection = [PdGlobEndpoint, PdGlobEndpoint]

export type Compilation = {
    readonly pd: PdJson.Pd
    readonly graph: DspGraph.Graph
    readonly nodeBuilders: NodeBuilders
}

interface CompilationSuccess {
    readonly status: 0
    readonly graph: DspGraph.Graph
    readonly arrays: DspGraph.Arrays
    readonly abstractionsLoadingWarnings?: AbstractionsLoadingWarnings
}

interface CompilationFailure {
    readonly status: 1
    readonly abstractionsLoadingErrors: AbstractionsLoadingErrors
    readonly abstractionsLoadingWarnings?: AbstractionsLoadingWarnings
}

type CompilationResult = CompilationSuccess | CompilationFailure

export const buildGraphNodeId = (
    patchId: PdJson.GlobalId,
    nodeLocalId: PdJson.LocalId
): DspGraph.NodeId => {
    return `${IdNamespaces.PD}_${patchId}_${nodeLocalId}`
}

export const buildMixerNodeId = (
    sinkId: DspGraph.NodeId,
    inletId: DspGraph.PortletId
): DspGraph.NodeId => {
    return `${IdNamespaces.MIXER}_${sinkId}_${inletId}`
}

// ================================== MAIN ================================== //
export default async (
    pd: PdJson.Pd,
    nodeBuilders: NodeBuilders,
    abstractionLoader: AbstractionLoader = async () => null
): Promise<CompilationResult> => {
    const abstractionsResult = await instantiateAbstractions(
        pd,
        nodeBuilders,
        abstractionLoader
    )
    const hasWarnings = Object.keys(abstractionsResult.warnings)

    if (abstractionsResult.status === 1) {
        return {
            status: 1,
            abstractionsLoadingErrors: abstractionsResult.errors,
            abstractionsLoadingWarnings: hasWarnings
                ? abstractionsResult.warnings
                : undefined,
        }
    }

    const { pd: pdWithResolvedAbstractions, rootPatch } = abstractionsResult
    const compilation: Compilation = {
        pd: pdWithResolvedAbstractions,
        nodeBuilders,
        graph: {},
    }
    _traversePatches(compilation, [rootPatch], _buildNodes)
    _buildConnections(compilation, [rootPatch])
    Object.values(compilation.graph).forEach((node) => {
        if (Object.keys(subpatchNodeBuilders).includes(node.type)) {
            dspGraph.mutation.deleteNode(compilation.graph, node.id)
        }
    })

    const arrays = Object.values(compilation.pd.arrays).reduce((arrays, array) => {
        arrays[array.args[0]] = array.data
            ? new Float32Array(array.data)
            : new Float32Array(array.args[1] as number)
        return arrays
    }, {} as DspGraph.Arrays)

    return {
        status: 0,
        graph: compilation.graph,
        arrays,
        abstractionsLoadingWarnings: hasWarnings
            ? abstractionsResult.warnings
            : undefined,
    }
}

// ================================== NODES ================================== //
export const _buildNodes = (
    compilation: Compilation,
    patchPath: PatchPath
): void => {
    const patch = _currentPatch(patchPath)
    const rootPatch = _rootPatch(patchPath)
    Object.values(patch.nodes).forEach((pdNode) => {
        const nodeId = buildGraphNodeId(patch.id, pdNode.id)
        _buildNode(compilation, rootPatch, patch, pdNode, nodeId)
    })
}

const _buildNode = (
    compilation: Compilation,
    rootPatch: PdJson.Patch,
    patch: PdJson.Patch,
    pdNode: PdJson.Node,
    nodeId: DspGraph.NodeId
): DspGraph.Node | null => {
    const nodeTypeResolution = resolveNodeType(
        compilation.nodeBuilders,
        pdNode.type
    )
    if (nodeTypeResolution === null) {
        throw new Error(`unknown node type ${pdNode.type}`)
    }

    const { nodeBuilder, nodeType } = nodeTypeResolution
    if (nodeBuilder.isNoop === true) {
        return null
    }

    if (!nodeBuilder.skipDollarArgsResolution) {
        pdNode = {
            ...pdNode,
            args: resolvePdNodeDollarArgs(rootPatch, pdNode.args),
        } as PdJson.Node
    }

    const nodeArgs = nodeBuilder.translateArgs(pdNode, patch, compilation.pd)
    const partialNode = nodeBuilder.build(nodeArgs)
    return dspGraph.mutation.addNode(compilation.graph, {
        id: nodeId,
        type: nodeType,
        args: nodeArgs,
        sources: {},
        sinks: {},
        ...partialNode,
    })
}

// ================================== CONNECTIONS ================================== //
export const _buildConnections = (
    compilation: Compilation,
    rootPatchPath: PatchPath
) => {
    let pdConnections: Array<PdGlobConnection> = []
    // 1. Get recursively through the patches and collect all pd connections
    // in one single array. In the process, we also resolve subpatch's portlets.
    _traversePatches(compilation, rootPatchPath, (compilation, patchPath) => {
        _collectPdConnections(compilation, patchPath, pdConnections)
    })

    // 2. In Pd, several signal sources are summed when connected to the same inlet.
    // `_buildConnection` is making that behavior explicit, therefore we can't create
    // all connections one by one, and need to batch all connections to the same sink.
    while (pdConnections.length) {
        const [_, pdGlobSink] = pdConnections[0]!
        let pdGlobSources: Array<PdGlobEndpoint> = []
        let remainingConnections: typeof pdConnections = []
        pdConnections.forEach((connection) => {
            const [pdGlobSource, otherPdGlobSink] = connection
            if (_arePdGlobEndpointsEqual(pdGlobSink, otherPdGlobSink)) {
                pdGlobSources.push(pdGlobSource)
            } else {
                remainingConnections.push(connection)
            }
        })
        pdConnections = remainingConnections
        _buildConnection(compilation, pdGlobSources, pdGlobSink)
    }
}

const _buildConnection = (
    compilation: Compilation,
    pdSources: Array<PdGlobEndpoint>,
    [sinkPatchPath, pdSink]: PdGlobEndpoint
) => {
    const { graph } = compilation
    const sinkPatch = _currentPatch(sinkPatchPath)
    const sinkRootPatch = _rootPatch(sinkPatchPath)
    const graphSink = {
        nodeId: buildGraphNodeId(sinkPatch.id, pdSink.nodeId),
        portletId: pdSink.portletId.toString(10),
    }
    const { nodeBuilder: sinkNodeBuilder } = resolveNodeType(
        compilation.nodeBuilders,
        resolvePdNode(sinkPatch, pdSink.nodeId).type
    )!
    const connections: Array<
        [DspGraph.ConnectionEndpoint, DspGraph.ConnectionEndpoint]
    > = []

    // 1. We separate signal sources from message sources
    const signalSources: Array<DspGraph.ConnectionEndpoint> = []
    const messageSources: Array<DspGraph.ConnectionEndpoint> = []
    pdSources.forEach(([sourcePatchPath, pdSource]) => {
        const sourcePatch = _currentPatch(sourcePatchPath)
        const graphSource = {
            nodeId: buildGraphNodeId(sourcePatch.id, pdSource.nodeId),
            portletId: pdSource.portletId.toString(10),
        }
        const sourceNode = dspGraph.getters.getNode(graph, graphSource.nodeId)
        const outlet = dspGraph.getters.getOutlet(
            sourceNode,
            graphSource.portletId
        )
        if (outlet.type === 'signal') {
            signalSources.push(graphSource)
        } else {
            messageSources.push(graphSource)
        }
    })

    // 2. If several signal sources, we place a mixer node in between
    // to make sure we really always have ONE signal inlet = ONE connection.
    if (signalSources.length > 1) {
        const mixerNode = _buildNode(
            compilation,
            sinkRootPatch,
            sinkPatch,
            {
                id: 'dummy',
                type: MIXER_NODE_TYPE,
                args: [signalSources.length],
                nodeClass: 'generic',
            },
            buildMixerNodeId(graphSink.nodeId, graphSink.portletId)
        )!

        dspGraph.mutation.connect(
            graph,
            {
                nodeId: mixerNode.id,
                portletId: '0',
            },
            graphSink
        )
        signalSources.forEach((source, i) => {
            connections.push([
                source,
                { nodeId: mixerNode.id, portletId: i.toString() },
            ])
        })
    } else {
        signalSources.forEach((source) => connections.push([source, graphSink]))
    }

    // 3. We re-route message connections if re-routing is declared on the node builder.
    messageSources.forEach((source) => {
        let reroutedSink: DspGraph.ConnectionEndpoint = graphSink
        if (sinkNodeBuilder.rerouteMessageConnection) {
            const newInletId = sinkNodeBuilder.rerouteMessageConnection(
                graphSink.portletId
            )
            if (newInletId !== undefined) {
                reroutedSink = {
                    nodeId: graphSink.nodeId,
                    portletId: newInletId,
                }
            }
        }
        connections.push([source, reroutedSink])
    })

    // Finally, we connect
    connections.forEach(([source, sink]) => {
        dspGraph.mutation.connect(graph, source, sink)
    })
}

/**
 * Traverse the graph recursively and collect all connections in a flat list,
 * by navigating inside and outside subpatches through their portlets.
 */
const _collectPdConnections = (
    compilation: Compilation,
    patchPath: PatchPath,
    pdConnections: Array<PdGlobConnection>
) => {
    const { graph } = compilation
    const patch = _currentPatch(patchPath)

    // First we remove connections for pd nodes that have been removed
    // from the graph.
    const connections = patch.connections.filter(({ source, sink }) => {
        const sourceNodeId = buildGraphNodeId(patch.id, source.nodeId)
        const sinkNodeId = buildGraphNodeId(patch.id, sink.nodeId)
        if (graph[sourceNodeId] && graph[sinkNodeId]) {
            return true
        }
        return false
    })

    connections.forEach(({ source, sink }) => {
        const resolvedSources = _resolveSource(compilation, [patchPath, source])
        const resolvedSinks = _resolveSink(compilation, patchPath, sink)
        resolvedSources.forEach((pdGSource) =>
            resolvedSinks.forEach((pdGSink) => {
                const alreadyExists = pdConnections.some(
                    ([otherPdGSource, otherPdGSink]) => {
                        return (
                            _arePdGlobEndpointsEqual(
                                pdGSource,
                                otherPdGSource
                            ) && _arePdGlobEndpointsEqual(pdGSink, otherPdGSink)
                        )
                    }
                )
                if (!alreadyExists) {
                    pdConnections.push([pdGSource, pdGSink])
                }
            })
        )
    })
}

const _resolveSource = (
    compilation: Compilation,
    [patchPath, source]: PdGlobEndpoint
): Array<PdGlobEndpoint> => {
    const { pd } = compilation
    const patch = _currentPatch(patchPath)
    const pdSourceNode = resolvePdNode(patch, source.nodeId)

    // 1. If inlet, we lookup in parent patch for the sources of the
    // corresponding inlets, then continue the resolution recursively.
    if (pdSourceNode.type === 'inlet' || pdSourceNode.type === 'inlet~') {
        const parentPatch = _parentPatch(patchPath)
        // When we load an abstraction as main patch, it will have
        // inlets / outlets which are not connected
        if (!parentPatch) {
            return []
        }
        const subpatchNode = _resolveSubpatchNode(parentPatch, patch.id)
        const subpatchNodePortletId = _resolveSubpatchPortletId(
            patch.inlets,
            pdSourceNode.id
        )
        return parentPatch.connections
            .filter(
                ({ sink }) =>
                    sink.nodeId === subpatchNode.id &&
                    sink.portletId === subpatchNodePortletId
            )
            .flatMap(({ source }) =>
                _resolveSource(compilation, [
                    [...patchPath.slice(0, -1)],
                    source,
                ])
            )

        // 2. If subpatch, we enter the subpatch and lookup for the
        // sources of the corresponding outlet, then continue the
        // resolution recursively.
    } else if (pdSourceNode.nodeClass === 'subpatch') {
        const subpatch = resolvePatch(pd, pdSourceNode.patchId)
        const outletPdNodeId = _resolveSubpatchPortletNode(
            subpatch.outlets,
            source.portletId
        )
        return subpatch.connections
            .filter(
                ({ sink }) =>
                    sink.nodeId === outletPdNodeId && sink.portletId === 0
            )
            .flatMap(({ source }) =>
                _resolveSource(compilation, [[...patchPath, subpatch], source])
            )

        // 3. This is the general case for all other nodes which are not
        // subpatch related.
    } else {
        return [[patchPath, source]]
    }
}

const _resolveSink = (
    compilation: Compilation,
    patchPath: PatchPath,
    pdSink: PdJson.ConnectionEndpoint
): Array<PdGlobEndpoint> => {
    const { pd } = compilation
    const patch = _currentPatch(patchPath)
    const pdSinkNode = resolvePdNode(patch, pdSink.nodeId)

    // 1. If outlet, we lookup in parent patch for the sinks of the
    // corresponding outlets, then continue the resolution recursively.
    if (pdSinkNode.type === 'outlet' || pdSinkNode.type === 'outlet~') {
        const parentPatch = _parentPatch(patchPath)
        // When we load an abstraction as main patch, it will have
        // inlets / outlets which are not connected
        if (!parentPatch) {
            return []
        }
        const subpatchNode = _resolveSubpatchNode(parentPatch, patch.id)
        const subpatchNodePortletId = _resolveSubpatchPortletId(
            patch.outlets,
            pdSinkNode.id
        )
        return parentPatch.connections
            .filter(
                ({ source }) =>
                    source.nodeId === subpatchNode.id &&
                    source.portletId === subpatchNodePortletId
            )
            .flatMap(({ sink }) =>
                _resolveSink(compilation, [...patchPath.slice(0, -1)], sink)
            )

        // 2. If subpatch, we enter the subpatch and lookup for the
        // sinks of the corresponding inlet, then continue the
        // resolution recursively.
    } else if (pdSinkNode.nodeClass === 'subpatch') {
        const subpatch = resolvePatch(pd, pdSinkNode.patchId)
        const inletPdNodeId = _resolveSubpatchPortletNode(
            subpatch.inlets,
            pdSink.portletId
        )
        return subpatch.connections
            .filter(
                ({ source }) =>
                    source.nodeId === inletPdNodeId && source.portletId === 0
            )
            .flatMap(({ sink }) =>
                _resolveSink(compilation, [...patchPath, subpatch], sink)
            )

        // 3. This is the general case for all other nodes which are not
        // subpatch related.
    } else {
        return [[patchPath, pdSink]]
    }
}

// ================================== HELPERS ================================== //
export const _traversePatches = (
    compilation: Compilation,
    patchPath: PatchPath,
    func: (compilation: Compilation, patchPath: PatchPath) => void
): void => {
    const patch = _currentPatch(patchPath)
    func(compilation, patchPath)
    Object.values(patch.nodes).forEach((pdNode) => {
        if (pdNode.nodeClass === 'subpatch') {
            const subpatch = resolvePatch(compilation.pd, pdNode.patchId)
            _traversePatches(compilation, [...patchPath, subpatch], func)
        }
    })
}

const _currentPatch = (patchPath: PatchPath) => {
    const patch = patchPath.slice(-1)[0]
    if (!patch) {
        throw new Error(`patchPath empty !`)
    }
    return patch
}

const _parentPatch = (patchPath: PatchPath) => patchPath.slice(-2)[0]

const _rootPatch = (patchPath: PatchPath) => {
    const firstRootPatch = patchPath
        .slice(0)
        .reverse()
        .find((patch) => patch.isRoot)
    if (!firstRootPatch) {
        throw new Error(`Could not resolve root patch from path`)
    }
    return firstRootPatch
}

const _resolveSubpatchPortletNode = (
    portletNodeIds: Array<PdJson.LocalId>,
    portletId: PdJson.PortletId
): PdJson.LocalId => {
    const pdNodeId = portletNodeIds[portletId]
    if (pdNodeId === undefined) {
        throw new Error(
            `Portlet ${portletId} is undefined in patch.outlets/patch.inlets`
        )
    }
    return pdNodeId
}

const _resolveSubpatchPortletId = (
    portletNodeIds: Array<PdJson.LocalId>,
    pdNodeId: PdJson.LocalId
): PdJson.PortletId =>
    portletNodeIds.findIndex((portletId) => portletId === pdNodeId)

const _resolveSubpatchNode = (
    patch: PdJson.Patch,
    patchId: PdJson.SubpatchNode['patchId']
): PdJson.Node => {
    const subpatchNode = Object.values(patch.nodes).find(
        (pdNode) =>
            pdNode.nodeClass === 'subpatch' && pdNode.patchId === patchId
    )
    if (subpatchNode === undefined) {
        throw new Error(`could not resolve subpatch node`)
    }
    return subpatchNode
}

const _arePdGlobEndpointsEqual = (
    [pp1, ep1]: PdGlobEndpoint,
    [pp2, ep2]: PdGlobEndpoint
): boolean =>
    _currentPatch(pp1).id === _currentPatch(pp2).id &&
    ep1.nodeId === ep2.nodeId &&
    ep1.portletId === ep2.portletId
