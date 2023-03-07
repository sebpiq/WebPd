import { AudioSettings as BaseAudioSettings, CompilationSettings, DspGraph, NodeImplementations } from '@webpd/compiler-js'
import { PdJson } from '@webpd/pd-parser'
import { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'

export const BUILD_FORMATS = {
    pd: {
        extensions: ['.pd'],
        description: 'Pure Data text',
    },
    pdJson: {
        extensions: ['.pd.json'],
        description: 'Pure Data JSON',
    },
    dspGraph: {
        extensions: ['.dsp-graph.json'],
        description: 'WebPd DSP graph',
    },
    compiledJs: {
        extensions: ['.js'],
        description: 'JavaScript DSP code',
    },
    compiledAsc: {
        extensions: ['.asc'],
        description: 'AssemblyScript DSP code',
    },
    wasm: {
        extensions: ['.wasm'],
        description: 'Web Assembly DSP module',
    },
    wav: {
        extensions: ['.wav'],
        description: 'WAV audio',
    }
}

export type BuildFormat = keyof typeof BUILD_FORMATS

export interface Artefacts {
    pd?: string
    pdJson?: PdJson.Pd
    dspGraph?: { graph: DspGraph.Graph; arrays: DspGraph.Arrays }
    compiledJs?: string
    compiledAsc?: string
    wasm?: ArrayBuffer
    wav?: Uint8Array
}

export interface AudioSettings extends BaseAudioSettings {
    sampleRate: number
    blockSize: number
    previewDurationSeconds: number
}

export interface Settings {
    audioSettings: AudioSettings
    nodeBuilders: NodeBuilders
    nodeImplementations: NodeImplementations
    abstractionLoader: AbstractionLoader
    inletCallerSpecs?: CompilationSettings['inletCallerSpecs']
}