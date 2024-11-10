import { PdJson } from "@webpd/pd-parser"

export const getRootPatch = (pdJson: PdJson.Pd) => {
    const patch = pdJson.patches[pdJson.rootPatchId]
    if (!patch) {
        throw new Error(`Missing root patch`)
    }
    return patch
}