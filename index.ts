// ================ Build
import { setAsc as setAsc_ } from './src/build/asc'
import {
    makeAbstractionLoader as makeAbstractionLoader_,
    UnknownNodeTypeError as UnknownNodeTypeError_,
} from './src/build/helpers'
import {
    createArtefacts as createArtefacts_,
    performBuildStep as performBuildStep_,
    preloadArtefact as preloadArtefact_,
    listOutputFormats as listOutputFormats_,
    listBuildSteps as listBuildSteps_,
    guessFormat as guessFormat_,
} from './src/build/build'
import { AbstractionLoader as AbstractionLoader_ } from './src/compile-dsp-graph/instantiate-abstractions'
import {
    BuildFormat as BuildFormat_,
    BUILD_FORMATS as BUILD_FORMATS_,
    Artefacts as Artefacts_,
    Settings as Settings_,
} from './src/build/types'
import {
    NODE_BUILDERS as NODE_BUILDERS_,
    NODE_IMPLEMENTATIONS as NODE_IMPLEMENTATIONS_,
} from './src/nodes/index'
import { buildGraphNodeId as buildGraphNodeId_ } from './src/compile-dsp-graph/to-dsp-graph'
export module Build {
    export type Artefacts = Artefacts_
    export type AbstractionLoader = AbstractionLoader_
    export type BuildFormat = BuildFormat_
    export type Settings = Settings_
    export const createArtefacts = createArtefacts_
    export const performBuildStep = performBuildStep_
    export const preloadArtefact = preloadArtefact_
    export const listOutputFormats = listOutputFormats_
    export const listBuildSteps = listBuildSteps_
    export const guessFormat = guessFormat_
    export const setAsc = setAsc_
    export const buildGraphNodeId = buildGraphNodeId_
    export const makeAbstractionLoader = makeAbstractionLoader_
    export const UnknownNodeTypeError = UnknownNodeTypeError_
    export const BUILD_FORMATS = BUILD_FORMATS_
    export const NODE_BUILDERS = NODE_BUILDERS_
    export const NODE_IMPLEMENTATIONS = NODE_IMPLEMENTATIONS_
}

// ================ DspGraph
export { DspGraph, Message } from '@webpd/compiler-js'
export { PdJson, CONTROL_TYPE } from '@webpd/pd-parser'

// ================ Runtime
import {
    WebPdWorkletNode as WebPdWorkletNode_,
    registerWebPdWorkletNode as registerWebPdWorkletNode_,
    fsWeb,
} from '@webpd/runtime'
export module Runtime {
    export const WebPdWorkletNode = WebPdWorkletNode_
    export const registerWebPdWorkletNode = registerWebPdWorkletNode_
    export const fs = { web: fsWeb }
}

// ================ AppGenerator
import {
    discoverGuiControls as discoverGuiControls_,
    traverseGuiControls as traverseGuiControls_,
    collectGuiControlsInletCallerSpecs as collectGuiControlsInletCallerSpecs_,
    ControlTree as ControlTree_,
    Control as Control_,
    ControlContainer as ControlContainer_,
    Comment as Comment_,
} from './src/app-generator/gui-controls'

export module AppGenerator {
    export const discoverGuiControls = discoverGuiControls_
    export const traverseGuiControls = traverseGuiControls_
    export const collectGuiControlsInletCallerSpecs =
        collectGuiControlsInletCallerSpecs_
    export type ControlTree = ControlTree_
    export type Control = Control_
    export type ControlContainer = ControlContainer_
    export type Comment = Comment_
}
