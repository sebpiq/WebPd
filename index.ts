import { setAsc } from './src/api/asc'
import {
    createArtefacts,
    performBuildStep,
    preloadArtefact,
    listOutputFormats,
    listBuildSteps,
    guessFormat,
} from './src/api/build'
export {
    NODE_BUILDERS,
    NODE_IMPLEMENTATIONS,
} from './src/compile-dsp-graph/nodes-index'
export const build = {
    createArtefacts,
    performBuildStep,
    preloadArtefact,
    listOutputFormats,
    listBuildSteps,
    guessFormat,
    setAsc: setAsc,
}
import { buildGraphNodeId } from './src/compile-dsp-graph/to-dsp-graph'
export const dspGraph = { buildGraphNodeId }
export {
    BuildFormat,
    BUILD_FORMATS,
    Artefacts,
    Settings,
} from './src/api/types'
export { DspGraph, Message } from '@webpd/compiler-js'
export { PdJson, CONTROL_TYPE } from '@webpd/pd-parser'
import {
    WebPdWorkletNode,
    registerWebPdWorkletNode,
    fsWeb,
} from '@webpd/runtime'
export const runtime = {
    WebPdWorkletNode,
    registerWebPdWorkletNode,
    fs: { web: fsWeb },
}
