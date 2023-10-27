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
import {
    AudioSettings,
    CompilationSettings,
    DspGraph,
    NodeImplementations,
} from '@webpd/compiler'
import { PdJson } from '@webpd/pd-parser'
import { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'

export type WasmBuffer = ArrayBuffer

export interface Artefacts {
    pd?: string
    pdJson?: PdJson.Pd
    dspGraph?: {
        graph: DspGraph.Graph
        arrays: DspGraph.Arrays
        pd: PdJson.Pd
        inletCallerSpecs?: CompilationSettings['inletCallerSpecs']
    }
    compiledJs?: string
    compiledAsc?: string
    wasm?: ArrayBuffer
    wav?: Uint8Array
    appTemplate?: { [filename: string]: string | ArrayBuffer }
}

export interface RenderAudioSettings {
    sampleRate: number
    blockSize: number
    previewDurationSeconds: number
}

export interface BuildSettings {
    audioSettings: AudioSettings
    renderAudioSettings: RenderAudioSettings
    nodeBuilders: NodeBuilders
    nodeImplementations: NodeImplementations
    abstractionLoader: AbstractionLoader
    inletCallerSpecs?: CompilationSettings['inletCallerSpecs']
}
