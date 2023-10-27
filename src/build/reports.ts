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
import { PdJson } from '@webpd/pd-parser'
import instantiateAbstractions, {
    AbstractionLoader,
} from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'
import { BuildSettings } from './types'

export const analysePd = async (
    pdJson: PdJson.Pd,
    abstractionLoader: AbstractionLoader,
    { nodeBuilders }: BuildSettings
) => {
    const resolveResult = await instantiateAbstractions(
        pdJson,
        nodeBuilders,
        abstractionLoader
    )
    const supportedTypes = getSupportedTypes(nodeBuilders)
    const objectTypesUsed = new Set<string>()
    const unimplementedObjectTypes = new Set<string>()

    if (resolveResult.status === 1) {
        Object.values(resolveResult.errors).forEach((abstractionErrors) => {
            if (abstractionErrors.unknownNodeType) {
                unimplementedObjectTypes.add(abstractionErrors.unknownNodeType)
            }
        })
    }

    if (resolveResult.pd) {
        Object.values(resolveResult.pd.patches).forEach((patch) => {
            Object.values(patch.nodes).forEach((node) => {
                if (supportedTypes.includes(node.type)) {
                    objectTypesUsed.add(node.type)
                }
            })
        })
    }

    return {
        unimplementedObjectTypes: unimplementedObjectTypes.size
            ? unimplementedObjectTypes
            : null,
        objectTypesUsed: objectTypesUsed.size ? objectTypesUsed : null,
        abstractions:
            resolveResult.status === 0 ? resolveResult.abstractions : null,
    }
}

export const getSupportedTypes = (nodeBuilders: NodeBuilders) => [
    ...Object.keys(nodeBuilders),
]
