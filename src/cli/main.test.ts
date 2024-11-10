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
import assert from 'assert'
import { exec as execCallback } from 'child_process'
import { readFile, readdir, mkdir } from 'fs/promises'
import { resolve } from 'path'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import path from 'path'
import { jest } from '@jest/globals';

jest.setTimeout(60 * 1000)
const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
const exec = promisify(execCallback)

describe('cli', () => {
    const CLI_PATH = resolve(__dirname, '..', '..', 'bin', 'cli.mjs')

    const TMP_DIR = './tmp'

    const TEST_SAMPLES_DURATION = 4

    const assertFileContentSame = async (
        pathActual: string,
        pathExpected: string,
        encoding: 'utf8' | 'binary'
    ) => {
        const actualFile = await readFile(pathActual, encoding)
        const expectedFile = await readFile(pathExpected, encoding)
        const _displayFile = (contents: string) =>
            `File[${contents.slice(0, 10)}... (length: ${contents.length})]`
        assert.ok(
            actualFile === expectedFile,
            `${_displayFile(
                actualFile
            )} content is not the same as ${_displayFile(expectedFile)}`
        )
    }

    beforeAll(async () => {
        await exec('npm run build:cli')
    })

    describe('generate from simple-osc.pd', () => {
        const PATHS = {
            patch: resolve(__dirname, 'test-assets', 'simple-osc.pd'),
            pdJson: resolve(__dirname, 'test-assets', 'simple-osc.pd.json'),
            dspGraph: resolve(
                __dirname,
                'test-assets',
                'simple-osc.dsp-graph.json'
            ),
            javascript: resolve(__dirname, 'test-assets', 'simple-osc.js'),
            assemblyscript: resolve(__dirname, 'test-assets', 'simple-osc.as'),
            wasm: resolve(__dirname, 'test-assets', 'simple-osc.wasm'),
            wav: resolve(__dirname, 'test-assets', 'simple-osc.wav'),
            app: resolve(__dirname, 'test-assets', 'simple-osc-app'),
        }

        it('should generate a pd.json file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.pd.json')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.pdJson, 'utf8')
        })

        it('should generate a dsp-graph.json file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.dsp-graph.json')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.dspGraph, 'utf8')
        })

        it('should generate a js file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.js')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.javascript, 'utf8')
        })

        it('should generate an as file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.as')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.assemblyscript, 'utf8')
        })

        it('should generate a wasm file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wasm')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.wasm, 'binary')
        })

        it('should generate a wav file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wav')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.wav, 'binary')
        })

        it('should generate an html app', async () => {
            const outDirPath = resolve(TMP_DIR, 'test-patch-app')
            await mkdir(outDirPath, { recursive: true })
            await exec(
                `node ${CLI_PATH} -i ${PATHS.patch} -o ${outDirPath} -f app`
            )
            const actualFiles = await readdir(outDirPath)
            const expectedFiles = await readdir(PATHS.app)
            actualFiles.sort()
            expectedFiles.sort()
            assert.deepStrictEqual(actualFiles, expectedFiles)
            for (let filename of actualFiles) {
                await assertFileContentSame(
                    resolve(outDirPath, filename),
                    resolve(PATHS.app, filename),
                    filename.endsWith('.wasm') ? 'binary' : 'utf8'
                )
            }
        })
    })

    describe('generate from io.pd', () => {
        const PATHS = {
            patch: resolve(__dirname, 'test-assets', 'io.pd'),
            app: resolve(__dirname, 'test-assets', 'io'),
        }

        it('should generate an html app', async () => {
            const outDirPath = resolve(TMP_DIR, 'test-patch-app')
            await mkdir(outDirPath, { recursive: true })
            await exec(
                `node ${CLI_PATH} -i ${PATHS.patch} -o ${outDirPath} -f app`
            )
            const actualFiles = await readdir(outDirPath)
            const expectedFiles = await readdir(PATHS.app)
            actualFiles.sort()
            expectedFiles.sort()
            assert.deepStrictEqual(actualFiles, expectedFiles)
            for (let filename of actualFiles) {
                await assertFileContentSame(
                    resolve(outDirPath, filename),
                    resolve(PATHS.app, filename),
                    filename.endsWith('.wasm') ? 'binary' : 'utf8'
                )
            }
        })
    })

    describe('generate from comments.pd', () => {
        const PATHS = {
            patch: resolve(__dirname, 'test-assets', 'comments.pd'),
            javascript: resolve(__dirname, 'test-assets', 'comments.js'),
            assemblyscript: resolve(__dirname, 'test-assets', 'comments.as'),
        }

        it('should generate a js file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.js')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.javascript, 'utf8')
        })

        it('should generate an as file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.as')
            await exec(`node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath}`)
            await assertFileContentSame(outPath, PATHS.assemblyscript, 'utf8')
        })
    })

    describe('Non-regression tests using example patch ginger2.pd', () => {
        const PATHS = {
            patch: resolve(__dirname, 'test-assets', 'ginger2.pd'),
            jsWav: resolve(__dirname, 'test-assets', 'ginger2.js.wav'),
            asWav: resolve(__dirname, 'test-assets', 'ginger2.as.wav'),
        }

        it('should generate correct wav with javascript engine', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wav')
            await exec(
                `node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath} --engine javascript --audio-duration ${TEST_SAMPLES_DURATION}`
            )
            await assertFileContentSame(outPath, PATHS.jsWav, 'binary')
        })

        it('should generate correct wav with wasm engine', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wav')
            await exec(
                `node ${CLI_PATH} -i ${PATHS.patch} -o ${outPath} --engine wasm --audio-duration ${TEST_SAMPLES_DURATION}`
            )
            await assertFileContentSame(outPath, PATHS.asWav, 'binary')
        })
    })

    describe('options', () => {
        const PATHS = {
            patch: resolve(__dirname, 'test-assets', 'simple-osc.pd'),
        }

        it('should support the --check-support option', async () => {
            await assert.doesNotReject(() =>
                exec(`node ${CLI_PATH} --check-support -i ${PATHS.patch}`)
            )
        })
    })
})
