import assert from 'assert'
import { findBuildSteps, BUILD_TREE, _findBuildPaths } from './artefacts'

describe('artefacts', () => {
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

    describe('findBuildSteps', () => {
        it('should build the task list between inFormat and outFormat', () => {
            assert.deepStrictEqual(findBuildSteps('compiledJs', 'wav'), [
                'compiledJs',
                'wav',
            ])
            assert.deepStrictEqual(findBuildSteps('dspGraph', 'wasm'), [
                'dspGraph',
                'compiledAsc',
                'wasm',
            ])
        })
    })
})
