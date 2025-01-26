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

import { PdJson } from '../../../WebPd_pd-parser/src/types'

type ConcisePdConnection = [
    PdJson.LocalId,
    PdJson.PortletId,
    PdJson.LocalId,
    PdJson.PortletId
]

type ConciseNode = Partial<PdJson.Node>

type ConcisePatch = Partial<Omit<PdJson.Patch, 'connections' | 'nodes'>> & {
    nodes?: { [localId: string]: ConciseNode }
    connections?: Array<ConcisePdConnection>
}

type ConciseArray = Partial<PdJson.PdArray>

type ConcisePd = {
    patches: { [patchId: string]: ConcisePatch }
    arrays?: { [arrayId: string]: ConciseArray }
    rootPatchId?: PdJson.GlobalId
}

export const pdJsonDefaults = (): PdJson.Pd => ({
    patches: {},
    arrays: {},
    rootPatchId: '0',
})

export const pdJsonArrayDefaults = (id: PdJson.GlobalId): PdJson.PdArray => ({
    id,
    args: [`arrayname-${id}`, 100, 0],
    layout: {},
    data: null,
})

export const pdJsonPatchDefaults = (id: PdJson.GlobalId): PdJson.Patch => ({
    id,
    isRoot: true,
    nodes: {},
    args: [],
    outlets: [],
    inlets: [],
    connections: [],
    layout: {},
})

export const pdJsonNodeDefaults = (
    id: PdJson.LocalId,
    type?: PdJson.NodeType
): PdJson.GenericNode => ({
    id,
    args: [],
    type: type || 'DUMMY',
    nodeClass: 'generic',
    layout: {},
})

export const makeConnection = (
    conciseConnection: ConcisePdConnection
): PdJson.Connection => ({
    source: {
        nodeId: conciseConnection[0],
        portletId: conciseConnection[1],
    },
    sink: {
        nodeId: conciseConnection[2],
        portletId: conciseConnection[3],
    },
})

export const makePd = (concisePd: ConcisePd): PdJson.Pd => {
    const pd: PdJson.Pd = pdJsonDefaults()

    Object.entries(concisePd.patches).forEach(([patchId, concisePatch]) => {
        let nodes: PdJson.Patch['nodes'] = {}
        if (concisePatch.nodes) {
            nodes = Object.entries(concisePatch.nodes).reduce(
                (nodes, [nodeId, conciseNode]) => ({
                    ...nodes,
                    [nodeId]: {
                        ...(pdJsonNodeDefaults(nodeId) as any),
                        ...conciseNode,
                    },
                }),
                {} as PdJson.Patch['nodes']
            )
        }
        pd.patches[patchId] = {
            ...pdJsonPatchDefaults(patchId),
            ...pd.patches[patchId],
            ...concisePatch,
            nodes,
            connections: (concisePatch.connections || []).map(makeConnection),
        }
    })

    if (concisePd.arrays) {
        Object.entries(concisePd.arrays).forEach(([arrayId, conciseArray]) => {
            pd.arrays[arrayId] = {
                ...pdJsonArrayDefaults(arrayId),
                ...conciseArray,
            }
        })
    }

    if (concisePd.rootPatchId !== undefined) {
        pd.rootPatchId = concisePd.rootPatchId
    }

    return pd
}
