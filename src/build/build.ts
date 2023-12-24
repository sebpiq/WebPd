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

import compile from '@webpd/compiler'
import parse from '@webpd/pd-parser'
import buildApp from './build-app'
import {
    discoverGuiControls,
} from '../gui-controls'
import { collectIoMessageReceiversFromGui, collectIoMessageReceiversFromSendNodes } from './io'
import toDspGraph from '../compile-dsp-graph/to-dsp-graph'
import { compileAssemblyscript } from './build-wasm'
import { renderWav } from './build-audio'
import {
    UnknownNodeTypeError,
    getArtefact,
    stringifyArrayBuffer,
} from './helpers'
import { Artefacts, BuildSettings } from './types'
import { BuildFormat, listBuildSteps } from './formats'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from '../nodes'
import { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'

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

/**
 * Simple build function to compile a Pd patch into compiled code
 * that can be directly run into a web app.
 *
 * Throws an error if the build fails.
 *
 * @see performBuildStep
 */
export const buildRunnable = async (
    pdFile: string,
    format: 'javascript' | 'wasm' = 'javascript',
    settings: BuildSettings
) => {
    if (!['wasm', 'javascript'].includes(format)) {
        throw new Error(`Invalid out format ${format}`)
    }

    const artefacts: Artefacts = { pd: pdFile }
    for (const step of listBuildSteps('pd', format)) {
        const result = await performBuildStep(artefacts, step, settings)
        if (result.status === 1) {
            throw new Error(`Build failed : ${result.errors.join('\n')}`)
        }
    }
    return artefacts[format]
}

export const defaultSettingsForBuild = (): BuildSettings => ({
    audioSettings: {
        channelCount: {
            in: 2,
            out: 2,
        },
        bitDepth: 64,
    },
    renderAudioSettings: {
        sampleRate: 44100,
        blockSize: 4096,
        previewDurationSeconds: 30,
    },
    abstractionLoader: alwaysFailingAbstractionLoader,
    nodeBuilders: NODE_BUILDERS,
    nodeImplementations: NODE_IMPLEMENTATIONS,
})

const alwaysFailingAbstractionLoader: AbstractionLoader = async (nodeType) => {
    throw new UnknownNodeTypeError(nodeType)
}

/**
 * @returns an empty artefacts object.
 */
export const createArtefacts = (): Artefacts => ({})

/**
 * Helper to unpack an artefact from an ArrayBuffer into its correct format.
 * Useful for example to load artefacts from files or http requests.
 *
 * @returns a new artefacts object.
 */
export const loadArtefact = (
    artefacts: Artefacts,
    artefactBuffer: ArrayBuffer,
    artefactFormat: BuildFormat
): Artefacts => {
    switch (artefactFormat) {
        case 'pd':
            return { ...artefacts, pd: stringifyArrayBuffer(artefactBuffer) }
        case 'pdJson':
            return {
                ...artefacts,
                pdJson: JSON.parse(stringifyArrayBuffer(artefactBuffer)),
            }
        case 'dspGraph':
            return {
                ...artefacts,
                dspGraph: JSON.parse(stringifyArrayBuffer(artefactBuffer)),
            }
        case 'javascript':
            return {
                ...artefacts,
                javascript: stringifyArrayBuffer(artefactBuffer),
            }
        case 'assemblyscript':
            return {
                ...artefacts,
                assemblyscript: stringifyArrayBuffer(artefactBuffer),
            }
        case 'wasm':
            return { ...artefacts, wasm: artefactBuffer }
        case 'wav':
            return { ...artefacts, wav: new Uint8Array(artefactBuffer) }

        default:
            throw new Error(
                `Unexpected format for preloading ${artefactFormat}`
            )
    }
}

/**
 * A helper to perform a build step on a given artefacts object.
 * If the build is successful, the artefacts object is updated in place with
 * the newly built artefact.
 *
 * Beware that this can only build one step at a time. If targetting a given format
 * requires multiple steps, you need to call this function multiple times with intermediate targets.
 *
 * @see fromPatch
 *
 * @param artefacts
 * @param target
 * @param settings
 */
export const performBuildStep = async (
    artefacts: Artefacts,
    target: BuildFormat,
    {
        nodeBuilders,
        nodeImplementations,
        audioSettings,
        renderAudioSettings,
        io = {},
        abstractionLoader,
    }: BuildSettings
): Promise<BuildResult> => {
    let warnings: Array<string> = []
    let errors: Array<string> = []

    switch (target) {
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
                // If io.messageReceivers are not defined, we infer them by
                // discovering UI controls and generating messageReceivers for each one.
                if (!io.messageReceivers) {
                    const { controls } = discoverGuiControls(
                        toDspGraphResult.pd
                    )
                    
                    io.messageReceivers = {
                        ...collectIoMessageReceiversFromGui(
                            controls,
                            toDspGraphResult.graph
                        ),
                        ...collectIoMessageReceiversFromSendNodes(
                            toDspGraphResult.pd,
                            toDspGraphResult.graph
                        )
                    }
                }

                artefacts.dspGraph = {
                    graph: toDspGraphResult.graph,
                    arrays: toDspGraphResult.arrays,
                    pd: toDspGraphResult.pd,
                    io: {
                        messageReceivers: {},
                        messageSenders: {},
                        ...io,
                    },
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

        case 'javascript':
        case 'assemblyscript':
            const compileCodeResult = compile(
                artefacts.dspGraph.graph,
                nodeImplementations,
                target,
                {
                    audio: audioSettings,
                    io: artefacts.dspGraph.io,
                    arrays: artefacts.dspGraph!.arrays,
                }
            )
            if (compileCodeResult.status === 0) {
                if (target === 'javascript') {
                    artefacts.javascript = compileCodeResult.code
                } else {
                    artefacts.assemblyscript = compileCodeResult.code
                }
                return { status: 0, warnings: [] }
            } else {
                return { status: 1, warnings: [], errors: [] }
            }

        case 'wasm':
            try {
                artefacts.wasm = await compileAssemblyscript(
                    getArtefact(artefacts, 'assemblyscript'),
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
                renderAudioSettings.previewDurationSeconds,
                artefacts,
                { ...audioSettings, ...renderAudioSettings }
            )
            return { status: 0, warnings: [] }

        case 'app':
            artefacts.app = buildApp(artefacts)
            return { status: 0, warnings: [] }

        default:
            throw new Error(`invalid build step ${target}`)
    }
}

const _makeUnknownNodeTypeMessage = (nodeTypeSet: Set<string>) => [
    `Unknown object types ${Array.from(nodeTypeSet)
        .map((nodeType) => `${nodeType}`)
        .join(', ')}`,
]

const _makeParseErrorMessages = (
    errorOrWarnings: Array<{ message: string; lineIndex: number }>
) =>
    errorOrWarnings.map(
        ({ message, lineIndex }) => `line ${lineIndex + 1} : ${message}`
    )
