import { PdJson } from '@webpd/pd-parser'
import instantiateAbstractions, {
    AbstractionLoader,
} from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'
import { Settings } from './types'

export const analysePd = async (
    pdJson: PdJson.Pd,
    abstractionLoader: AbstractionLoader,
    { nodeBuilders }: Settings
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
