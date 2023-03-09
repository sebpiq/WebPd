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

import { DspGraph } from '@webpd/compiler-js'
import { nodeDefaults } from '@webpd/compiler-js/src/dsp-graph/test-helpers'
import { AudioSettings, CompilerTarget } from '@webpd/compiler-js/src/types'
import { PdJson } from '@webpd/pd-parser'
import {
    makePd,
    pdJsonNodeDefaults,
} from '@webpd/pd-parser/src/test-helpers'
import assert from 'assert'
import { NodeBuilder, PartialNode } from '../compile-dsp-graph/types'

export const SAMPLE_RATE = 44100

export interface NodeImplementationTestParameters {
    target: CompilerTarget
    bitDepth: AudioSettings['bitDepth']
    floatArrayType: typeof Float32Array | typeof Float64Array
}

export const NODE_IMPLEMENTATION_TEST_PARAMETERS: Array<NodeImplementationTestParameters> =
    [
        { target: 'javascript', bitDepth: 32, floatArrayType: Float32Array },
        // { target: 'javascript', bitDepth: 64, floatArrayType: Float64Array },
        // {
        //     target: 'assemblyscript',
        //     bitDepth: 32,
        //     floatArrayType: Float32Array,
        // },
        // {
        //     target: 'assemblyscript',
        //     bitDepth: 64,
        //     floatArrayType: Float64Array,
        // },
    ]

export const buildNode = <NodeArgsType>(
    nodeBuilder: NodeBuilder<NodeArgsType>,
    type: DspGraph.NodeType,
    args: NodeArgsType
): DspGraph.Node => {
    return {
        ...nodeDefaults('DUMMY', type),
        type,
        args: args as unknown as DspGraph.NodeArguments,
        ...nodeBuilder.build(args),
    }
}

const TEST_PD = makePd({patches: {'0': {}}})
export const TEST_PATCH = TEST_PD.patches['0']
export const TEST_NODE_ID = '0'

export const testNodeTranslateArgs = <NodeArguments>(
    nodeBuilder: NodeBuilder<NodeArguments>,
    args: PdJson.NodeArgs,
    expectedNodeArgs: NodeArguments,
    patch = TEST_PATCH
) => {
    const pdNode = {
        ...pdJsonNodeDefaults(TEST_NODE_ID),
        args,
    }
    const nodeArgs = nodeBuilder.translateArgs(pdNode, patch, TEST_PD)
    assert.deepStrictEqual(nodeArgs, expectedNodeArgs)
}

export const testNodeBuild = <NodeArguments>(
    nodeBuilder: NodeBuilder<NodeArguments>,
    nodeArgs: NodeArguments,
    expectedPartialNode: Partial<PartialNode>
) => {
    const partialNode = nodeBuilder.build(nodeArgs)
    Object.entries(expectedPartialNode).forEach(([key, value]) => {
        assert.ok(key in partialNode)
        assert.deepStrictEqual((partialNode as any)[key], value)
    })
}

export const testParametersCombine = <T>(key: string, values: ReadonlyArray<any>) =>
    values.map(
        (value) =>
            NODE_IMPLEMENTATION_TEST_PARAMETERS.map((params) => ({
                ...params,
                [key]: value,
            }))
    ).flat() as Array<NodeImplementationTestParameters & T>