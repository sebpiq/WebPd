import { PdJson } from '@webpd/pd-parser'
import instantiateAbstractions, { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'
import { Settings } from './types'

// export const analysePd = async (
//     pdJson: PdJson.Pd,
//     abstractionLoader: AbstractionLoader,
//     { nodeBuilders }: Settings
// ) => {
//     const {pd: pdWithResolvedAbstractions, abstractions} =
//         await instantiateAbstractions(pdJson, nodeBuilders, abstractionLoader)
//     const supportedTypes = getSupportedTypes(nodeBuilders)

//     const unimplementedObjectTypes = new Set<string>()
//     const objectTypesUsed = new Set<string>()
//     Object.values(pdWithResolvedAbstractions.patches).forEach((patch) => {
//         Object.values(patch.nodes).forEach((node) => {
//             if (!supportedTypes.includes(node.type)) {
//                 unimplementedObjectTypes.add(node.type)
//             } else {
//                 objectTypesUsed.add(node.type)
//             }
//         })
//     })

//     return { unimplementedObjectTypes, objectTypesUsed, abstractions }
// }

// export const getSupportedTypes = (nodeBuilders: NodeBuilders) => [
//     ...Object.keys(nodeBuilders)
// ]
