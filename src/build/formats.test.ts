/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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
import assert from 'assert'
import { listBuildSteps, _findBuildPaths, _traverseBuildTree, listOutputFormats, guessFormat } from './formats'
import { BUILD_TREE } from './formats'
import { BuildFormat } from './formats'

describe('formats', () => {

    describe('listBuildSteps', () => {
        it('should build the task list between inFormat and outFormat', () => {
            assert.deepStrictEqual(listBuildSteps('javascript', 'wav'), [
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('dspGraph', 'wasm'), [
                'assemblyscript',
                'wasm',
            ])
            assert.deepStrictEqual(listBuildSteps('wasm', 'wav'), [
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('pdJson', 'pdJson'), [])
        })

        it('should filter with intermediate step', () => {
            assert.deepStrictEqual(listBuildSteps('pd', 'wav', 'javascript'), [
                'pdJson',
                'dspGraph',
                'javascript',
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('pd', 'wav', 'assemblyscript'), [
                'pdJson',
                'dspGraph',
                'assemblyscript',
                'wasm',
                'wav',
            ])
            assert.deepStrictEqual(listBuildSteps('wasm', 'wav', 'wasm'), [
                'wav',
            ])
        })
    })

    describe('listOutputFormats', () => {
        it('should find all out formats for a given in format', () => {
            assert.deepStrictEqual(listOutputFormats('javascript'), new Set([
                'wav', 'app'
            ]))
            assert.deepStrictEqual(listOutputFormats('dspGraph'), new Set([
                'javascript', 'wav', 'assemblyscript', 'wasm', 'app'
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
                ['pd', 'pdJson', 'dspGraph', 'javascript', 'wav'],
                ['pd', 'pdJson', 'dspGraph', 'assemblyscript', 'wasm', 'wav'],
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
                ['pd', 'pdJson', 'dspGraph', 'javascript', 'wav'],
                ['pd', 'pdJson', 'dspGraph', 'assemblyscript', 'wasm', 'wav'],
                ['pd', 'pdJson', 'dspGraph', 'assemblyscript', 'wasm', 'app'],
                ['pd', 'pdJson', 'dspGraph', 'javascript', 'app'],
            ])
        })
    })
})
