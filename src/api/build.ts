import compile from '@webpd/compiler-js'
import parse from '@webpd/pd-parser'
import toDspGraph from '../compile-dsp-graph/to-dsp-graph'
import { compileAsc } from './asc'
import { renderWav } from './audio'
import { getArtefact, stringifyArrayBuffer } from './helpers'
import { Artefacts, BuildFormat, BUILD_FORMATS, Settings } from './types'

type BuildTree = Array<BuildFormat | BuildTree>
export const BUILD_TREE: BuildTree = [
    'pd',
    'pdJson',
    'dspGraph',
    [
        ['compiledJs', 'wav'],
        ['compiledAsc', 'wasm', 'wav'],
    ],
]

interface BuildSuccess {
    status: 0
    warnings: Array<string>
}

interface BuildFailure {
    status: 1
    warnings: Array<string>
    errors: Array<string>
}

export type BuildResult = BuildSuccess | BuildFailure

export const createArtefacts = (): Artefacts => ({})

export const preloadArtefact = (
    artefacts: Artefacts,
    inBuffer: ArrayBuffer,
    inFormat: BuildFormat
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
        case 'wav':
            return { ...artefacts, wav: new Uint8Array(inBuffer) }

        default:
            throw new Error(`Unexpected format ${inFormat}`)
    }
}

export const performBuildStep = async (
    artefacts: Artefacts,
    buildStep: BuildFormat,
    {
        nodeBuilders,
        nodeImplementations,
        audioSettings,
        inletCallerSpecs,
        abstractionLoader,
    }: Settings
): Promise<BuildResult> => {
    let warnings: Array<string> = []
    let errors: Array<string> = []

    switch (buildStep) {
        case 'pdJson':
            const parseResult = parse(artefacts.pd!)
            if (parseResult.status === 0) {
                artefacts.pdJson = parseResult.pd
                return {
                    status: 0,
                    warnings: _makeParseErrorMessages(parseResult.warnings),
                }
            } else {
                return {
                    status: 1,
                    warnings: _makeParseErrorMessages(parseResult.warnings),
                    errors: _makeParseErrorMessages(parseResult.errors),
                }
            }

        case 'dspGraph':
            const toDspGraphResult = await toDspGraph(
                artefacts.pdJson!,
                nodeBuilders,
                abstractionLoader
            )

            if (toDspGraphResult.abstractionsLoadingWarnings) {
                warnings = Object.entries(
                    toDspGraphResult.abstractionsLoadingWarnings
                )
                .filter(([_, warnings]) => !!warnings.length)
                .flatMap(([nodeType, warnings]) => [
                    `Warnings when parsing abstraction ${nodeType} :`,
                    ..._makeParseErrorMessages(warnings),
                ])
            }

            if (toDspGraphResult.status === 0) {
                artefacts.dspGraph = {
                    graph: toDspGraphResult.graph,
                    arrays: toDspGraphResult.arrays,
                }
                return { status: 0, warnings }
            } else {
                const unknownNodeTypes = Object.values(
                    toDspGraphResult.abstractionsLoadingErrors
                )
                    .filter((errors) => !!errors.unknownNodeType)
                    .map((errors) => errors.unknownNodeType)

                if (unknownNodeTypes.length) {
                    errors = [
                        ...errors,
                        ..._makeUnknownNodeTypeMessage(
                            new Set(unknownNodeTypes)
                        ),
                    ]
                }

                errors = [
                    ...errors,
                    ...Object.entries(
                        toDspGraphResult.abstractionsLoadingErrors
                    )
                        .filter(([_, errors]) => !!errors.parsingErrors)
                        .flatMap(([nodeType, errors]) => [
                            `Failed to parse abstraction ${nodeType} :`,
                            ..._makeParseErrorMessages(errors.parsingErrors),
                        ]),
                ]

                return {
                    status: 1,
                    errors,
                    warnings,
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
                    inletCallerSpecs,
                    arrays: artefacts.dspGraph!.arrays,
                }
            )
            if (compileCodeResult.status === 0) {
                if (buildStep === 'compiledJs') {
                    artefacts.compiledJs = compileCodeResult.code
                } else {
                    artefacts.compiledAsc = compileCodeResult.code
                }
                return { status: 0, warnings: [] }
            } else {
                return { status: 1, warnings: [], errors: [] }
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
                    warnings: [],
                }
            }
            return { status: 0, warnings: [] }

        case 'wav':
            artefacts.wav = await renderWav(
                audioSettings.previewDurationSeconds,
                artefacts,
                audioSettings
            )
            return { status: 0, warnings: [] }

        default:
            throw new Error(`invalid build step ${buildStep}`)
    }
}

export const guessFormat = (filepath: string): BuildFormat | null => {
    const formats = Object.entries(BUILD_FORMATS).filter(([_, specs]) => {
        if (
            specs.extensions.some((extension) => filepath.endsWith(extension))
        ) {
            return true
        }
        return false
    })
    if (formats.length === 0) {
        return null
    }
    return formats[0][0] as BuildFormat
}

export const listBuildSteps = (
    inFormat: BuildFormat,
    outFormat: BuildFormat,
    intermediateStep?: BuildFormat
): Array<BuildFormat> => {
    let paths = _findBuildPaths(BUILD_TREE, outFormat, [])
        .filter((path) => path.includes(inFormat))
        .map((path) => path.slice(path.indexOf(inFormat) + 1))

    if (intermediateStep) {
        paths = paths.filter((path) => path.includes(intermediateStep))
    }

    if (paths.length === 0) {
        return null
    }
    return paths[0]
}

export const listOutputFormats = (inFormat: BuildFormat): Set<BuildFormat> =>
    new Set(
        _traverseBuildTree(BUILD_TREE, [])
            .filter((path) => path.includes(inFormat))
            .map((path) => path.slice(path.indexOf(inFormat) + 1))
            .flat()
    )

const _makeUnknownNodeTypeMessage = (nodeTypeSet: Set<string>) => [
    `Unknown object types ${Array.from(nodeTypeSet)
        .map((nodeType) => `${nodeType}`)
        .join(', ')}`,
]

const _makeParseErrorMessages = (
    errorOrWarnings: Array<{ message: string; lineIndex: number }>
) =>
    errorOrWarnings.map(
        ({ message, lineIndex }) => `line ${lineIndex} : ${message}`
    )

export const _findBuildPaths = (
    branch: BuildTree,
    target: BuildFormat,
    parentPath: Array<BuildFormat>
): Array<Array<BuildFormat>> => {
    let path: Array<BuildFormat> = [...parentPath]
    return branch.flatMap((node) => {
        if (Array.isArray(node)) {
            return _findBuildPaths(node, target, path)
        }
        path = [...path, node]
        if (node === target) {
            return [path]
        }
        return []
    })
}

export const _traverseBuildTree = (
    branch: BuildTree,
    parentPath: Array<BuildFormat>
): Array<Array<BuildFormat>> => {
    let path: Array<BuildFormat> = [...parentPath]
    return branch.flatMap((node, i) => {
        if (Array.isArray(node)) {
            return _traverseBuildTree(node, path)
        }
        path = [...path, node]
        if (i === branch.length - 1) {
            return [path]
        }
        return []
    })
}
