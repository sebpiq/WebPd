import compile from '@webpd/compiler-js'
import parse from '@webpd/pd-parser'
import toDspGraph from '../compile-dsp-graph/to-dsp-graph'
import { compileAsc } from './asc'
import { renderWav } from './audio'
import {
    getArtefact,
    makeParseErrorMessages,
    stringifyArrayBuffer,
} from './helpers'
import { Artefacts, Format, Settings } from './types'

type BuildTree = Array<Format | BuildTree>
export const BUILD_TREE: BuildTree = [
    'pd',
    'pdJson',
    'dspGraph',
    [
        ['compiledJs', 'wav'],
        ['compiledAsc', 'wasm', 'wav'],
    ],
]

interface CompilationSuccess {
    status: 0
    warnings?: Array<string>
}

interface CompilationFailure {
    status: 1
    errors?: Array<string>
}

export type CompilationResult = CompilationSuccess | CompilationFailure

export const preloadArtefact = (
    artefacts: Artefacts,
    inBuffer: ArrayBuffer,
    inFormat: Format
): Artefacts => {
    switch (inFormat) {
        case 'pd':
            return { ...artefacts, pd: stringifyArrayBuffer(inBuffer) }
        case 'pdJson':
            return {
                ...artefacts,
                pdJson: JSON.parse(stringifyArrayBuffer(inBuffer)),
            }
        case 'dspGraph':
            return {
                ...artefacts,
                dspGraph: JSON.parse(stringifyArrayBuffer(inBuffer)),
            }
        case 'compiledJs':
            return { ...artefacts, compiledJs: stringifyArrayBuffer(inBuffer) }
        case 'compiledAsc':
            return { ...artefacts, compiledAsc: stringifyArrayBuffer(inBuffer) }
        case 'wasm':
            return { ...artefacts, wasm: inBuffer }

        default:
            throw new Error(`Unexpected format ${inFormat}`)
    }
}

export const findBuildSteps = (inFormat: Format, outFormat: Format) => {
    const path = _findBuildPaths(BUILD_TREE, outFormat, []).find((path) =>
        path.includes(inFormat)
    )
    if (!path) {
        return null
    }
    return path.slice(path.indexOf(inFormat))
}

export const buildArtefact = async (
    artefacts: Artefacts,
    buildStep: Format,
    {
        nodeBuilders,
        nodeImplementations,
        audioSettings,
        abstractionLoader,
    }: Settings
): Promise<CompilationResult> => {
    switch (buildStep) {
        case 'pdJson':
            const parseResult = parse(artefacts.pd!)
            if (parseResult.status === 0) {
                artefacts.pdJson = parseResult.pd
                return {
                    status: 0,
                    warnings: makeParseErrorMessages(parseResult.warnings),
                }
            } else {
                return {
                    status: 1,
                    errors: makeParseErrorMessages(parseResult.errors),
                }
            }

        case 'dspGraph':
            const toDspGraphResult = await toDspGraph(
                artefacts.pdJson!,
                nodeBuilders,
                abstractionLoader
            )
            if (toDspGraphResult.status === 0) {
                artefacts.dspGraph = {
                    graph: toDspGraphResult.graph,
                    arrays: toDspGraphResult.arrays,
                }
                return { status: 0 }
            } else {
                return {
                    status: 1,
                    errors: _makeUnknownNodeTypeMessage(
                        toDspGraphResult.unknownNodeTypes
                    ),
                }
            }

        case 'compiledJs':
        case 'compiledAsc':
            const compileCodeResult = compile(
                artefacts.dspGraph!.graph,
                nodeImplementations,
                {
                    target:
                        buildStep === 'compiledJs'
                            ? 'javascript'
                            : 'assemblyscript',
                    audioSettings,
                    arrays: artefacts.dspGraph!.arrays,
                }
            )
            if (compileCodeResult.status === 0) {
                if (buildStep === 'compiledJs') {
                    artefacts.compiledJs = compileCodeResult.code
                } else {
                    artefacts.compiledAsc = compileCodeResult.code
                }
                return { status: 0 }
            } else {
                return { status: 1 }
            }

        case 'wasm':
            try {
                artefacts.wasm = await compileAsc(
                    getArtefact(artefacts, 'compiledAsc'),
                    audioSettings.bitDepth
                )
            } catch (err: any) {
                return {
                    status: 1,
                    errors: [err.message],
                }
            }
            return { status: 0 }

        case 'wav':
            artefacts.wav = await renderWav(
                audioSettings.previewDurationSeconds,
                artefacts,
                audioSettings
            )
            return { status: 0 }

        default:
            throw new Error(`invalid build step ${buildStep}`)
    }
}

const _makeUnknownNodeTypeMessage = (nodeTypeSet: Set<string>) => [
    `Unknown object types ${Array.from(nodeTypeSet)
        .map((nodeType) => `[${nodeType}]`)
        .join(' ')}`,
]

export const _findBuildPaths = (
    branch: BuildTree,
    target: Format,
    parentPath: Array<Format>
): Array<Array<Format>> => {
    let path: Array<Format> = [...parentPath]
    return branch
        .flatMap((buildStep) => {
            if (Array.isArray(buildStep)) {
                return _findBuildPaths(buildStep, target, path)
            }
            path = [...path, buildStep]
            if (buildStep === target) {
                return [path]
            }
            return []
        })
        .filter((path) => path)
}
