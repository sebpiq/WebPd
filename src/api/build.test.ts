import assert from 'assert'
import { listBuildSteps, BUILD_TREE, _findBuildPaths, _traverseBuildTree, listOutputFormats, guessFormat } from './build'
import { BuildFormat } from './types'

describe('artefacts', () => {

    describe('listBuildSteps', () => {
        it('should build the task list between inFormat and outFormat', () => {
            assert.deepStrictEqual(listBuildSteps('compiledJs', 'wav'), [
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('dspGraph', 'wasm'), [
                'compiledAsc',
                'wasm',
            ])
            assert.deepStrictEqual(listBuildSteps('pdJson', 'pdJson'), [])
        })

        it('should filter with intermediate step', () => {
            assert.deepStrictEqual(listBuildSteps('pd', 'wav', 'compiledJs'), [
                'pdJson',
                'dspGraph',
                'compiledJs',
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('pd', 'wav', 'compiledAsc'), [
                'pdJson',
                'dspGraph',
                'compiledAsc',
                'wasm',
                'wav',
            ])
        })
    })

    describe('listOutputFormats', () => {
        it('should find all out formats for a given in format', () => {
            assert.deepStrictEqual(listOutputFormats('compiledJs'), new Set([
                'wav'
            ]))
            assert.deepStrictEqual(listOutputFormats('dspGraph'), new Set([
                'compiledJs', 'wav', 'compiledAsc', 'wasm',
            ]))
            assert.deepStrictEqual(listOutputFormats('wav'), new Set())
        })
    })

    describe('guessFormat', () => {
        it('should detect the right format', () => {
            assert.strictEqual<BuildFormat>(guessFormat('/tmp/bla.pd.json'), 'pdJson')
            assert.strictEqual<BuildFormat>(guessFormat('/tmp/bla.wasm'), 'wasm')
        })
    })

    describe('_findBuildPaths', () => {
        it('should find paths properly in the build tree', () => {
            assert.deepStrictEqual(_findBuildPaths(BUILD_TREE, 'wav', []), [
                ['pd', 'pdJson', 'dspGraph', 'compiledJs', 'wav'],
                ['pd', 'pdJson', 'dspGraph', 'compiledAsc', 'wasm', 'wav'],
            ])

            assert.deepStrictEqual(_findBuildPaths(BUILD_TREE, 'dspGraph', []), [
                ['pd', 'pdJson', 'dspGraph'],
            ])

            assert.deepStrictEqual(_findBuildPaths(BUILD_TREE, 'pd', []), [['pd']])
        })
    })

    describe('_traverseBuildTree', () => {
        it('should find all paths in the build tree', () => {
            assert.deepStrictEqual(_traverseBuildTree(BUILD_TREE, []), [
                ['pd', 'pdJson', 'dspGraph', 'compiledJs', 'wav'],
                ['pd', 'pdJson', 'dspGraph', 'compiledAsc', 'wasm', 'wav'],
            ])
        })
    })
})
