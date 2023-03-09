import { ParsingWarningOrError, PdJson } from '@webpd/pd-parser'
import {
    resolveArrayDollarArgs,
    resolveNodeType,
    resolvePatch,
    resolvePdNodeDollarArgs,
} from './compile-helpers'
import { NodeBuilders } from './types'

interface AbstractionLoaderSuccess {
    status: 0
    pd: PdJson.Pd
    parsingWarnings?: Array<ParsingWarningOrError>
}

interface AbstractionLoaderFailure {
    status: 1
    parsingWarnings?: Array<ParsingWarningOrError>
    unknownNodeType?: PdJson.NodeType
    parsingErrors?: Array<ParsingWarningOrError>
}

type AbstractionLoaderResult =
    | AbstractionLoaderSuccess
    | AbstractionLoaderFailure

/**
 * An aync function that is passed to the parser and has for role
 * to fetch/load/... any node type that is not yet known to the parser.
 * If fetching that new node type fails (because of a parsing error,
 * or because the node is not known), the function can return `{status: 1}`
 * with the appropriate error fields.
 */
export type AbstractionLoader = (
    nodeType: PdJson.NodeType
) => Promise<AbstractionLoaderResult>

type AbstractionNamemapEntry = Map<PdJson.GlobalId, PdJson.GlobalId>
interface AbstractionNamemap {
    readonly patches: AbstractionNamemapEntry
    readonly arrays: AbstractionNamemapEntry
}

type Abstractions = { [nodeType: string]: PdJson.Pd }
export type AbstractionsLoadingErrors = {
    [nodeType: string]: {
        unknownNodeType?: PdJson.NodeType
        parsingErrors?: Array<ParsingWarningOrError>
    }
}

export type AbstractionsLoadingWarnings = {
    [nodeType: string]: Array<ParsingWarningOrError>
}

export type NodeTypes = Set<PdJson.NodeType>

interface Compilation {
    pd: PdJson.Pd
    readonly nodeBuilders: NodeBuilders
    readonly abstractionLoader: AbstractionLoader
    readonly abstractions: Abstractions
    readonly errors: AbstractionsLoadingErrors
    readonly warnings: AbstractionsLoadingWarnings
}

interface CompilationSuccess {
    readonly status: 0
    readonly pd: PdJson.Pd
    readonly rootPatch: PdJson.Patch
    readonly abstractions: Abstractions
    readonly warnings: AbstractionsLoadingWarnings
}

interface CompilationFailure {
    readonly status: 1
    readonly pd: PdJson.Pd
    readonly errors: AbstractionsLoadingErrors
    readonly warnings: AbstractionsLoadingWarnings
}

type CompilationResult = CompilationSuccess | CompilationFailure

/**
 * Goes through a pd object, resolves and instantiates abstractions, turning
 * them into standard subpatches.
 * @returns A new PdJson.Pd object, which contains all patches and arrays
 * from the resolved abstraction as well as those from the pd object passed as argument.
 * The second value returned is the main root patch to be used for further processing.
 */
export default async (
    pd: PdJson.Pd,
    nodeBuilders: NodeBuilders,
    abstractionLoader: AbstractionLoader
): Promise<CompilationResult> => {
    const [namemap, pdWithReassignedIds] = _reassignUniquePdGlobalIds(
        { patches: {}, arrays: {} },
        pd
    )

    const compilation: Compilation = {
        pd: pdWithReassignedIds,
        nodeBuilders,
        abstractions: {},
        errors: {},
        warnings: {},
        abstractionLoader,
    }

    const rootPatch = _resolveRootPatch(compilation.pd)
    Object.values(compilation.pd.arrays).forEach(
        (array) => (array.args = resolveArrayDollarArgs(rootPatch, array.args))
    )

    await _instantiateAbstractionsRecurs(
        compilation,
        rootPatch,
        rootPatch,
        namemap
    )

    const hasErrors = Object.keys(compilation.errors).length
    if (hasErrors) {
        return {
            status: 1,
            pd: compilation.pd,
            errors: compilation.errors,
            warnings: compilation.warnings,
        }
    } else {
        return {
            status: 0,
            pd: compilation.pd,
            rootPatch: resolvePatch(compilation.pd, rootPatch.id),
            abstractions: compilation.abstractions,
            warnings: compilation.warnings,
        }
    }
}

const _instantiateAbstractionsRecurs = async (
    compilation: Compilation,
    rootPatch: PdJson.Patch,
    patch: PdJson.Patch,
    namemap: AbstractionNamemap
): Promise<void> => {
    const { pd, abstractionLoader, errors, warnings } = compilation
    patch.nodes = { ...patch.nodes }
    for (let pdNode of Object.values(patch.nodes)) {
        if (errors.hasOwnProperty(pdNode.type)) {
            continue
        }

        // 1. If subpatch, resolve its `patchId` according to the namemap,
        // and continue recursively by entering inside the subpatch
        if (pdNode.nodeClass === 'subpatch') {
            pdNode = patch.nodes[pdNode.id] = {
                ...pdNode,
                patchId: _resolveIdNamemap(namemap.patches, pdNode.patchId),
            }
            await _instantiateAbstractionsRecurs(
                compilation,
                rootPatch,
                resolvePatch(pd, pdNode.patchId),
                namemap
            )
            continue

            // 2. If array, resolve its `arrayId` according to the namemap.
        } else if (pdNode.nodeClass === 'array') {
            pdNode = patch.nodes[pdNode.id] = {
                ...pdNode,
                arrayId: _resolveIdNamemap(namemap.arrays, pdNode.arrayId),
            }
            continue
        }

        // 3. If normal node, whose type resolves from the `nodeBuilders`,
        // we do nothing.
        if (resolveNodeType(compilation.nodeBuilders, pdNode.type) !== null) {
            continue
        }

        // 4. Otherwise, if node type could not be resolved, we load as an abstraction.
        const resolutionResult = await _resolveAbstraction(
            compilation,
            pdNode.type,
            abstractionLoader
        )
        if (resolutionResult.parsingWarnings) {
            warnings[pdNode.type] = resolutionResult.parsingWarnings
        }
        if (resolutionResult.status === 1) {
            const { status, parsingWarnings, ...abstractionErrors } =
                resolutionResult
            errors[pdNode.type] = abstractionErrors
            continue
        }

        // Since the abstraction is loaded as an independant PdJson.Pd object,
        // the global ids of its patches and arrays, might clash with the ids
        // in our `pd` object. Therefore, we need to reassign these ids.
        const [newNamemap, abstractionInstance] = _reassignUniquePdGlobalIds(
            pd,
            resolutionResult.pd
        )
        const newRootPatch = _resolveRootPatch(abstractionInstance)

        // Replace the abstraction node by a subpatch node, so that the abstraction
        // can be dealt with the same way a subpatch is handled.
        pdNode = patch.nodes[pdNode.id] = {
            ...pdNode,
            args: resolvePdNodeDollarArgs(rootPatch, pdNode.args),
            nodeClass: 'subpatch',
            patchId: newRootPatch.id,
            type: 'pd',
        }

        // Prepare the new root patch, resolve arrays args, because it won't be done
        // further down in the code.
        newRootPatch.args = pdNode.args
        Object.values(abstractionInstance.arrays).forEach(
            (array) =>
                (array.args = resolveArrayDollarArgs(newRootPatch, array.args))
        )

        // Finally, combine the abstraction patches and arrays with the ones in `pd`.
        // At this stage ids should not collide, and references saved in `namemap`,
        // so we can recurse to deal with nodes inside the abstraction.
        pd.patches = {
            ...pd.patches,
            ...abstractionInstance.patches,
        }

        pd.arrays = {
            ...pd.arrays,
            ...abstractionInstance.arrays,
        }

        await _instantiateAbstractionsRecurs(
            compilation,
            newRootPatch,
            newRootPatch,
            newNamemap
        )
    }
}

const _resolveRootPatch = (pd: PdJson.Pd): PdJson.Patch => {
    const rootPatches = Object.values(pd.patches).filter(
        (patch) => patch.isRoot
    )
    if (rootPatches.length !== 1) {
        throw new Error(`Expected exactly one root patch`)
    }
    return rootPatches[0]!
}

const _resolveAbstraction = async (
    compilation: Compilation,
    nodeType: PdJson.NodeType,
    abstractionLoader: AbstractionLoader
): Promise<AbstractionLoaderResult> => {
    if (!compilation.abstractions[nodeType]) {
        const result = await abstractionLoader(nodeType)
        if (result.status === 0) {
            compilation.abstractions[nodeType] = result.pd
        }
        return result
    }
    return {
        status: 0,
        pd: compilation.abstractions[nodeType],
    }
}

const _resolveIdNamemap = (
    map: AbstractionNamemapEntry,
    objectId: PdJson.GlobalId
): PdJson.GlobalId => {
    const newObjectId = map.get(objectId)
    if (newObjectId === undefined) {
        throw new Error(`Could not resolve ${objectId}`)
    }
    return newObjectId
}

const _reassignUniquePdGlobalIds = (
    pd: PdJson.Pd,
    pdToReassign: PdJson.Pd
): [AbstractionNamemap, PdJson.Pd] => {
    const pdWithReassignedIds: PdJson.Pd = {
        patches: {},
        arrays: {},
    }
    const namemap: AbstractionNamemap = {
        patches: new Map(),
        arrays: new Map(),
    }
    let patchesIds = Object.keys(pd.patches)
    patchesIds = patchesIds.length ? patchesIds : ['-1']
    let arraysIds = Object.keys(pd.arrays)
    arraysIds = arraysIds.length ? arraysIds : ['-1']
    let patchesIdCounter = Math.max(...patchesIds.map((id) => parseInt(id))) + 1
    let arraysIdCounter = Math.max(...arraysIds.map((id) => parseInt(id))) + 1

    Object.entries(pdToReassign.patches).forEach(([oldId, patch]) => {
        const newId = `${patchesIdCounter++}`
        namemap.patches.set(oldId, newId)
        pdWithReassignedIds.patches[newId] = {
            ...patch,
            id: newId,
        }
    })
    Object.entries(pdToReassign.arrays).forEach(([oldId, array]) => {
        const newId = `${arraysIdCounter++}`
        namemap.arrays.set(oldId, newId)
        pdWithReassignedIds.arrays[newId] = {
            ...array,
            id: newId,
        }
    })
    return [namemap, pdWithReassignedIds]
}
