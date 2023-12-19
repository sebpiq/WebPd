import assert from 'assert'
import { exec as execCallback } from 'child_process'
import { readFile, readdir, mkdir } from 'fs/promises'
import { resolve } from 'path'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))
const exec = promisify(execCallback)

describe('cli', () => {
    const CLI_PATH = resolve(__dirname, '..', 'bin', 'cli.mjs')
    const PATCH_PATH = resolve(__dirname, 'cli-assets', 'simple-osc.pd')
    const SNAPSHOTS_PATHS = {
        pdJson: resolve(__dirname, 'cli-assets', 'simple-osc.pd.json'),
        dspGraph: resolve(__dirname, 'cli-assets', 'simple-osc.dsp-graph.json'),
        javascript: resolve(__dirname, 'cli-assets', 'simple-osc.js'),
        assemblyscript: resolve(__dirname, 'cli-assets', 'simple-osc.as'),
        wasm: resolve(__dirname, 'cli-assets', 'simple-osc.wasm'),
        wav: resolve(__dirname, 'cli-assets', 'simple-osc.wav'),
        app: resolve(__dirname, 'cli-assets', 'simple-osc-app'),
    }
    const TMP_DIR = './tmp'

    const assertFileContentSame = async (
        pathActual: string,
        pathExpected: string,
        encoding: 'utf8' | 'binary'
    ) => {
        const actualFile = await readFile(pathActual, encoding)
        const expectedFile = await readFile(pathExpected, encoding)
        assert.deepStrictEqual(actualFile, expectedFile, `File ${pathActual} content is not the same as ${pathExpected}`)
    }

    beforeAll(async () => {
        await exec('npm run build:cli')
    })

    describe('generate', () => {
        it('should generate a pd.json file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.pd.json')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.pdJson, 'utf8')
        })

        it('should generate a dsp-graph.json file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.dsp-graph.json')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.dspGraph, 'utf8')
        })

        it('should generate a js file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.js')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.javascript, 'utf8')
        })

        it('should generate an as file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.as')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.assemblyscript, 'utf8')
        })

        it('should generate a wasm file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wasm')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.wasm, 'binary')
        })

        it('should generate a wav file', async () => {
            const outPath = resolve(TMP_DIR, 'test-patch.wav')
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outPath}`)
            await assertFileContentSame(outPath, SNAPSHOTS_PATHS.wav, 'binary')
        })

        it('should generate an html app', async () => {
            const outDirPath = resolve(TMP_DIR, 'test-patch-app')
            await mkdir(outDirPath, { recursive: true })
            await exec(`node ${CLI_PATH} -i ${PATCH_PATH} -o ${outDirPath} -f app`)
            const actualFiles = await readdir(outDirPath)
            const expectedFiles = await readdir(SNAPSHOTS_PATHS.app)
            actualFiles.sort()
            expectedFiles.sort()
            assert.deepStrictEqual(actualFiles, expectedFiles)
            for (let filename of actualFiles) {
                await assertFileContentSame(
                    resolve(outDirPath, filename),
                    resolve(SNAPSHOTS_PATHS.app, filename),
                    filename.endsWith('.wasm') ? 'binary': 'utf8'
                )
            }
        })
    })

    describe('options', () => {
        it('should support the --check-support option', async () => {
            await assert.doesNotReject(() => exec(`node ${CLI_PATH} --check-support -i ${PATCH_PATH}`))
        })
    })
})
