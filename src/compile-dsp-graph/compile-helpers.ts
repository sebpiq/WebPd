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

import { NodeBuilder, NodeBuilders } from './types'
import { DspGraph } from '@webpd/compiler-js'
import { PdJson } from '@webpd/pd-parser'

/** Regular expressions to deal with dollar-args */
const DOLLAR_VAR_REGEXP = /\$(\d+)/

export const resolvePatch = (
    pd: PdJson.Pd,
    patchId: PdJson.GlobalId
): PdJson.Patch => {
    const patch = pd.patches[patchId]
    if (!patch) {
        throw new Error(`Patch ${patchId} not found`)
    }
    return patch
}

export const resolvePdNode = (
    patch: PdJson.Patch,
    nodeId: PdJson.LocalId
): PdJson.Node => {
    const pdNode = patch.nodes[nodeId]
    if (!pdNode) {
        throw new Error(`Pd node ${nodeId} not found in patch ${patch.id}`)
    }
    return pdNode
}

export const resolveNodeType = (
    nodeBuilders: NodeBuilders,
    nodeType: PdJson.NodeType
): { nodeType: DspGraph.NodeType; nodeBuilder: NodeBuilder<any> } | null => {
    const nodeBuilder = nodeBuilders[nodeType]
    if (!nodeBuilder) {
        return null
    }
    if (nodeBuilder.aliasTo) {
        return resolveNodeType(nodeBuilders, nodeBuilder.aliasTo)
    } else {
        return { nodeBuilder: nodeBuilder as NodeBuilder<any>, nodeType }
    }
}

/**
 * Takes an object string arg which might contain dollars, and returns the resolved version.
 * e.g. : [table $0-ARRAY] inside a patch with ID 1887 would resolve to [table 1887-ARRAY]
 */
export const resolveDollarArg = (arg: string, patch: PdJson.Patch) => {
    // Since we have string patch ids and Pd uses int, we parse
    // patch id back to int. This is useful for example so that
    // [float $0] would work.
    const patchIdInt = parseInt(patch.id)
    if (isNaN(patchIdInt)) {
        throw new Error(`Invalid patch id`)
    }
    const patchArgs = [patchIdInt, ...patch.args]
    const dollarVarRegex = new RegExp(DOLLAR_VAR_REGEXP, 'g')
    let matchDollar
    while ((matchDollar = dollarVarRegex.exec(arg))) {
        const index = parseInt(matchDollar[1]!, 10)
        const isWithinRange = 0 <= index && index < patchArgs.length
        if (matchDollar[0] === arg) {
            return isWithinRange ? patchArgs[index] : undefined
        } else {
            if (isWithinRange) {
                arg = arg.replace(matchDollar[0], patchArgs[index]!.toString())
            }
        }
    }
    return arg
}

export const resolveArrayDollarArgs = (
    rootPatch: PdJson.Patch,
    args: PdJson.PdArray['args']
): PdJson.PdArray['args'] => {
    const name = resolveDollarArg(args[0], rootPatch)
    const size =
        typeof args[1] === 'string'
            ? resolveDollarArg(args[1], rootPatch)
            : args[1]
    return [
        (name === undefined ? '' : name).toString(),
        size === undefined ? 0 : size,
        args[2],
    ]
}

export const resolvePdNodeDollarArgs = (
    rootPatch: PdJson.Patch,
    args: PdJson.NodeArgs
): PdJson.NodeArgs =>
    args.map((arg) =>
        typeof arg === 'string' ? resolveDollarArg(arg, rootPatch) : arg
    )
