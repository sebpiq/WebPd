import { PdJson } from "@webpd/pd-parser"
import { getRootPatch } from "./utils"
import { Comment } from "./types"


export const discoverPdGuiComments = (pdJson: PdJson.Pd) => {
    const rootPatch = getRootPatch(pdJson)
    return Object.values(rootPatch.nodes)
        .filter((node) => node.type === 'text')
        .map((node) => {
            const comment: Comment = {
                type: 'comment',
                patch: rootPatch,
                node,
                text: node.args[0]!.toString(),
            }
            return comment
        })
}