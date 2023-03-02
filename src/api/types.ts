import { AudioSettings as BaseAudioSettings, DspGraph, NodeImplementations } from '@webpd/compiler-js'
import { PdJson } from '@webpd/pd-parser'
import { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'
import { NodeBuilders } from '../compile-dsp-graph/types'

export const FORMATS = {
    pd: {
        extensions: ['.pd'],
    },
    pdJson: {
        extensions: ['.pd.json'],
    },
    dspGraph: {
        extensions: ['.dsp-graph.json'],
    },
    compiledJs: {
        extensions: ['.js'],
    },
    compiledAsc: {
        extensions: ['.asc'],
    },
    wasm: {
        extensions: ['.wasm'],
    },
    wav: {
        extensions: ['.wav']
    }
}

export type Format = keyof typeof FORMATS

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
}