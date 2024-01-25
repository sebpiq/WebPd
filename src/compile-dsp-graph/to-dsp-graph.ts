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

import { MessageToSignalConfig, NodeBuilders } from './types'
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
import {
    builder as mixerNodeBuilder,
    NodeArguments as MixerNodeArguments,
} from '../nodes/nodes/_mixer~'
import {
    builder as sigNodeBuilder,
    NodeArguments as SigNodeArguments,
} from '../nodes/nodes/sig~'
import {
    builder as routeMsgNodeBuilder,
    NodeArguments as RouteMsgNodeArguments,
} from '../nodes/nodes/_routemsg'
import { DspGraph, dspGraph } from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'

const IMPLICIT_NODE_TYPES = {
    MIXER: '_mixer~',
    ROUTE_MSG: '_routemsg',
    CONSTANT_SIGNAL: 'sig~',
}

enum IdNamespaces {
    PD = 'n',
    /** Node added for enabling translation from pd to dp graph  */
    IMPLICIT_NODE = 'm',
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
    /** PdJson.Pd with all abstractions resolved. */
    readonly pd: PdJson.Pd
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

export const buildGraphPortletId = (pdPortletId: PdJson.PortletId) =>
    pdPortletId.toString(10)

/** Node id for nodes added while converting from PdJson */
export const buildImplicitGraphNodeId = (
    sink: DspGraph.ConnectionEndpoint,
    nodeType: DspGraph.NodeType
): DspGraph.NodeId => {
    nodeType = nodeType.replaceAll(/[^a-zA-Z0-9_]/g, '')
    return `${IdNamespaces.IMPLICIT_NODE}_${sink.nodeId}_${sink.portletId}_${nodeType}`
}

// ================================== MAIN ================================== //
export default async (
    pd: PdJson.Pd,
    nodeBuilders: NodeBuilders,
    abstractionLoader: AbstractionLoader = async (nodeType) => ({
        status: 1,
        unknownNodeType: nodeType,
    })
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

    const { pd: pdWithResolvedAbstractions } = abstractionsResult
    const compilation: Compilation = {
        pd: pdWithResolvedAbstractions,
        nodeBuilders,
        graph: {},
    }
    const rootPatch = _resolveRootPatch(pdWithResolvedAbstractions)
    _traversePatches(compilation, [rootPatch], _buildNodes)
    _buildConnections(compilation, [rootPatch])
    Object.values(compilation.graph).forEach((node) => {
        if (Object.keys(subpatchNodeBuilders).includes(node.type)) {
            dspGraph.mutators.deleteNode(compilation.graph, node.id)
        }
    })

    const arrays = Object.values(compilation.pd.arrays).reduce(
        (arrays, array) => {
            arrays[array.args[0]] = array.data
                ? new Float32Array(array.data)
                : new Float32Array(array.args[1] as number)
            return arrays
        },
        {} as DspGraph.Arrays
    )

    return {
        status: 0,
        graph: compilation.graph,
        pd: compilation.pd,
        arrays,
        abstractionsLoadingWarnings: hasWarnings
            ? abstractionsResult.warnings
            : undefined,
    }
}

// ================================== DSP GRAPH NODES ================================== //
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
    return dspGraph.mutators.addNode(compilation.graph, {
        id: nodeId,
        type: nodeType,
        args: nodeArgs,
        sources: {},
        sinks: {},
        ...partialNode,
    })
}

// ==================================  DSP GRAPH CONNECTIONS ================================== //
export const _buildConnections = (
    compilation: Compilation,
    rootPatchPath: PatchPath
) => {
    const { graph } = compilation
    let pdConnections: Array<PdGlobConnection> = []

    // 1. Get recursively through the patches and collect all pd connections
    // in one single array. In the process, we also resolve subpatch's portlets.
    _traversePatches(compilation, rootPatchPath, (compilation, patchPath) => {
        _resolveSubpatches(compilation, patchPath, pdConnections)
    })

    // 2. Convert connections from PdJson to DspGraph, and group them by source
    const groupedGraphConnections = _groupAndResolveGraphConnections(
        compilation,
        pdConnections
    )

    // 3. Finally, we iterate over the grouped sources and build the graph connections.
    Object.values(graph).forEach((node) => {
        Object.values(node.inlets).forEach((inlet) => {
            const graphSink = {
                nodeId: node.id,
                portletId: inlet.id,
            }

            const graphSources = (groupedGraphConnections[node.id]
                ? groupedGraphConnections[node.id][inlet.id]
                : undefined) || { signalSources: [], messageSources: [] }

            if (inlet.type === 'signal') {
                const { nodeBuilder: sinkNodeBuilder } = resolveNodeType(
                    compilation.nodeBuilders,
                    node.type
                )!

                const messageToSignalConfig: MessageToSignalConfig =
                    sinkNodeBuilder.configureMessageToSignalConnection
                        ? sinkNodeBuilder.configureMessageToSignalConnection(
                              graphSink.portletId,
                              node.args
                          )
                        : undefined

                _buildConnectionToSignalSink(
                    graph,
                    graphSources.signalSources,
                    graphSources.messageSources,
                    graphSink,
                    messageToSignalConfig
                )
            } else {
                if (graphSources.signalSources.length !== 0) {
                    throw new Error(
                        `Unexpected signal connection to node id ${graphSink.nodeId}, inlet ${graphSink.portletId}`
                    )
                }

                _buildConnectionToMessageSink(
                    graph,
                    graphSources.messageSources,
                    graphSink
                )
            }
        })
    })
}

const _buildConnectionToMessageSink = (
    graph: DspGraph.Graph,
    sources: Array<DspGraph.ConnectionEndpoint>,
    sink: DspGraph.ConnectionEndpoint
) =>
    sources.forEach((source) => {
        dspGraph.mutators.connect(graph, source, sink)
    })

/**
 * Build a graph connection. Add nodes that are implicit in Pd, and that we want explicitely
 * declared in our graph.
 *
 * Implicit Pd behavior made explicit by this compilation :
 * - Multiple DSP inputs mixed into one
 *
 * ```
 * [ signal1~ ]   [ signal2~ ]
 *           \      /
 *         [ _mixer~ ]
 *           |
 *         [ someNode~ ]
 *
 * ```
 *
 * - When messages to DSP input, automatically turned into a signal
 *
 * ```
 *    [ sig~ ]
 *      |
 *    [  someNode~ ]
 * ```
 *
 * - Re-route messages from signal inlet to a message inlet
 *
 * ```
 *    [ message1 ]
 *      |
 *    [ _routemsg ]     ( on the left inlet float messages, on the the right inlet, the rest. )
 *      |       \
 *    [ sig~ ]   |
 *      |        |
 *    [  someNode~ ]
 * ```
 *
 * - Initial value of DSP input
 *
 *
 */
const _buildConnectionToSignalSink = (
    graph: DspGraph.Graph,
    signalSources: Array<DspGraph.ConnectionEndpoint>,
    messageSources: Array<DspGraph.ConnectionEndpoint>,
    sink: DspGraph.ConnectionEndpoint,
    messageToSignalConfig?: MessageToSignalConfig
) => {
    let implicitSigNode: DspGraph.Node | null = null

    // 1. SIGNAL SOURCES
    // 1.1. if single signal source, we just put a normal connection
    if (signalSources.length === 1) {
        dspGraph.mutators.connect(graph, signalSources[0], sink)

        // 1.2. if several signal sources, we put a mixer node in between.
    } else if (signalSources.length > 1) {
        const mixerNodeArgs: MixerNodeArguments = {
            channelCount: signalSources.length,
        }
        const implicitMixerNode = dspGraph.mutators.addNode(graph, {
            id: buildImplicitGraphNodeId(sink, IMPLICIT_NODE_TYPES.MIXER),
            type: IMPLICIT_NODE_TYPES.MIXER,
            args: mixerNodeArgs,
            sources: {},
            sinks: {},
            ...mixerNodeBuilder.build(mixerNodeArgs),
        })
        dspGraph.mutators.connect(
            graph,
            {
                nodeId: implicitMixerNode.id,
                portletId: '0',
            },
            sink
        )
        signalSources.forEach((source, i) => {
            dspGraph.mutators.connect(graph, source, {
                nodeId: implicitMixerNode.id,
                portletId: buildGraphPortletId(i),
            })
        })

        // 1.3. if no signal source, we need to simulate one by plugging a sig node to the inlet
    } else {
        const sigNodeArgs: SigNodeArguments = {
            initValue: messageToSignalConfig
                ? messageToSignalConfig.initialSignalValue
                : 0,
        }
        implicitSigNode = dspGraph.mutators.addNode(graph, {
            id: buildImplicitGraphNodeId(
                sink,
                IMPLICIT_NODE_TYPES.CONSTANT_SIGNAL
            ),
            type: IMPLICIT_NODE_TYPES.CONSTANT_SIGNAL,
            args: sigNodeArgs,
            sources: {},
            sinks: {},
            ...sigNodeBuilder.build(sigNodeArgs),
        })
        dspGraph.mutators.connect(
            graph,
            {
                nodeId: implicitSigNode.id,
                portletId: '0',
            },
            sink
        )
    }

    // 2. MESSAGE SOURCES
    // If message sources, we split the incoming message flow in 2 using `_routemsg`.
    // - outlet 0 : float messages are proxied to the sig~ if present, so they set its value
    // - outlet 1 : other messages must be proxied to a different sink (cause here we are dealing
    // with a signal sink which can't accept messages).
    if (messageSources.length) {
        const routeMsgArgs: RouteMsgNodeArguments = {}
        const implicitRouteMsgNode = dspGraph.mutators.addNode(graph, {
            id: buildImplicitGraphNodeId(sink, IMPLICIT_NODE_TYPES.ROUTE_MSG),
            type: IMPLICIT_NODE_TYPES.ROUTE_MSG,
            args: routeMsgArgs,
            sources: {},
            sinks: {},
            ...routeMsgNodeBuilder.build(routeMsgArgs),
        })
        let isMsgSortNodeConnected = false

        if (implicitSigNode) {
            dspGraph.mutators.connect(
                graph,
                { nodeId: implicitRouteMsgNode.id, portletId: '0' },
                { nodeId: implicitSigNode.id, portletId: '0' }
            )
            isMsgSortNodeConnected = true
        }

        if (
            messageToSignalConfig &&
            messageToSignalConfig.reroutedMessageInletId !== undefined
        ) {
            dspGraph.mutators.connect(
                graph,
                { nodeId: implicitRouteMsgNode.id, portletId: '1' },
                {
                    nodeId: sink.nodeId,
                    portletId: messageToSignalConfig.reroutedMessageInletId,
                }
            )
            isMsgSortNodeConnected = true
        }

        if (isMsgSortNodeConnected) {
            messageSources.forEach((graphMessageSource) => {
                dspGraph.mutators.connect(graph, graphMessageSource, {
                    nodeId: implicitRouteMsgNode.id,
                    portletId: '0',
                })
            })
        }
    }
}

/**
 * Take an array of global PdJson connections and :
 * - group them by sink
 * - convert them to graph connections
 * - split them into signal and message connections
 */
const _groupAndResolveGraphConnections = (
    compilation: Compilation,
    pdConnections: Array<PdGlobConnection>
) => {
    const { graph } = compilation
    const groupedGraphConnections: {
        [nodeId: DspGraph.NodeId]: {
            [portletId: DspGraph.PortletId]: {
                signalSources: Array<DspGraph.ConnectionEndpoint>
                messageSources: Array<DspGraph.ConnectionEndpoint>
            }
        }
    } = {}
    pdConnections.forEach((connection) => {
        const [_, pdGlobSink] = connection

        // Resolve the graph sink corresponding with the connection,
        // if already handled, we move on.
        const [patchPath, pdSink] = pdGlobSink
        const graphNodeId = buildGraphNodeId(
            _currentPatch(patchPath).id,
            pdSink.nodeId
        )
        groupedGraphConnections[graphNodeId] = groupedGraphConnections[graphNodeId] || {}

        const graphPortletId = buildGraphPortletId(pdSink.portletId)
        if (groupedGraphConnections[graphNodeId][graphPortletId]) {
            return
        }

        // Collect all sources for `pdGlobSink`
        let pdGlobSources: Array<PdGlobEndpoint> = []
        pdConnections.forEach((connection) => {
            const [pdGlobSource, otherPdGlobSink] = connection
            if (_arePdGlobEndpointsEqual(pdGlobSink, otherPdGlobSink)) {
                pdGlobSources.push(pdGlobSource)
            }
        })

        // For each source, resolve it to a graph source, and split between
        // signal and message sources.
        const graphSignalSources: Array<DspGraph.ConnectionEndpoint> = []
        const graphMessageSources: Array<DspGraph.ConnectionEndpoint> = []
        pdGlobSources.forEach(([sourcePatchPath, pdSource]) => {
            const sourcePatch = _currentPatch(sourcePatchPath)
            const graphSource = {
                nodeId: buildGraphNodeId(sourcePatch.id, pdSource.nodeId),
                portletId: buildGraphPortletId(pdSource.portletId),
            }
            const sourceNode = dspGraph.getters.getNode(
                graph,
                graphSource.nodeId
            )
            const outlet = dspGraph.getters.getOutlet(
                sourceNode,
                graphSource.portletId
            )
            if (outlet.type === 'signal') {
                graphSignalSources.push(graphSource)
            } else {
                graphMessageSources.push(graphSource)
            }
        })

        groupedGraphConnections[graphNodeId][graphPortletId] = {
            signalSources: graphSignalSources,
            messageSources: graphMessageSources,
        }
    })

    return groupedGraphConnections
}

/**
 * Traverse the graph recursively and collect all connections in a flat list,
 * by navigating inside and outside subpatches through their portlets.
 */
const _resolveSubpatches = (
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

const _parentPatch = (patchPath: PatchPath): PdJson.Patch | null => {
    if (patchPath.length < 2) {
        return null
    }
    return patchPath.slice(-2)[0]
}

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

const _resolveRootPatch = (pd: PdJson.Pd): PdJson.Patch => {
    const rootPatch = pd.patches[pd.rootPatchId]
    if (!rootPatch) {
        throw new Error(`Could not resolve root patch`)
    }
    return rootPatch
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
        throw new Error(
            `could not find subpatch node with patchId=${patchId} inside patch ${patch.id}`
        )
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
