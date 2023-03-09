import colors from 'colors/safe'
import packageInfo from './package.json'
import { fileURLToPath } from 'url'
import asc from 'assemblyscript/dist/asc.js'
import { PdJson } from '@webpd/pd-parser'
import { program } from 'commander'
import * as path from 'path'
import fs from 'fs'
import { Artefacts, BuildFormat, Settings } from './src/api/types'
import { setAsc } from './src/api/asc'
import { analysePd } from './src/api/reports'
import {
    performBuildStep,
    listBuildSteps,
    preloadArtefact,
    guessFormat,
} from './src/api/build'
import {
    getArtefact,
    makeAbstractionLoader,
    UnknownNodeTypeError,
} from './src/api/helpers'
import { AbstractionLoader } from './src/compile-dsp-graph/instantiate-abstractions'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from './src/nodes/index'
setAsc(asc)

const BIT_DEPTH = 64
const BLOCK_SIZE = 1024 * 8
const SAMPLE_RATE = 44100
const CHANNEL_COUNT = { in: 2, out: 2 }
const WAV_PREVIEW_DURATION = 15

interface Task {
    inFilepath: string
    inFormat: BuildFormat
    outFilepath: string | null
    outFormat: BuildFormat
    artefacts: Artefacts
}

const consoleLogHeader = (message: string) =>
    console.log('\n~~~ ' + colors.bold(message))
const consoleLogEm = (message: string) => console.log(colors.bold(message))

const checkSupportPdJson = async (
    pdJson: PdJson.Pd,
    abstractionLoader: AbstractionLoader,
    settings: Settings
) => {
    const { unimplementedObjectTypes } = await analysePd(
        pdJson,
        abstractionLoader,
        settings
    )

    let isSupported = true
    consoleLogHeader(`Check support `)
    if (unimplementedObjectTypes) {
        console.log(
            `${
                unimplementedObjectTypes.size
            } object types not implemented : ${Array.from(
                unimplementedObjectTypes
            )
                .map((type) => `[${type}]`)
                .join(', ')}`
        )
        isSupported = false
    }

    if (isSupported) {
        consoleLogEm(`OK`)
    } else {
        consoleLogEm(`NOT SUPPORTED`)
    }
}

const whatsImplemented = () => {
    consoleLogHeader(`What's implemented ?`)
    console.log(
        `${
            Object.keys(NODE_BUILDERS).length
        } object implemented : ${Object.keys(NODE_BUILDERS)
            .map((type) => `[${type}]`)
            .join(', ')}`
    )
}

const assertValidFormat = (
    format: BuildFormat | null,
    filepath: string
): format is BuildFormat => {
    ifConditionThenExitError(
        format === null,
        `Unknown input file format for ${filepath}`
    )
    return true
}

const writeOutFile = async (task: Task): Promise<Task> => {
    consoleLogEm(`Generating output`)
    const { outFilepath, outFormat, artefacts } = task
    const written: Array<string> = []
    let outDir: string | null = null
    if (outFormat && outFilepath) {
        switch (outFormat) {
            case 'pdJson':
            case 'dspGraph':
                await fs.promises.writeFile(
                    outFilepath!,
                    JSON.stringify(getArtefact(artefacts, outFormat), null, 2)
                )
                written.push(outFilepath)
                break

            case 'compiledJs':
            case 'compiledAsc':
                await fs.promises.writeFile(
                    outFilepath!,
                    getArtefact(artefacts, outFormat)
                )
                written.push(outFilepath)
                break

            case 'wasm':
                await fs.promises.writeFile(
                    outFilepath!,
                    Buffer.from(getArtefact(artefacts, outFormat))
                )
                written.push(outFilepath)
                break

            case 'wav':
                await fs.promises.writeFile(
                    outFilepath!,
                    getArtefact(artefacts, outFormat)
                )
                written.push(outFilepath)
                break

            case 'appTemplate':
                const appTemplate = getArtefact(artefacts, outFormat)
                outDir = path.dirname(outFilepath)
                for (let filename of Object.keys(appTemplate)) {
                    const filepath = path.resolve(outDir, filename)
                    const fileContents = appTemplate[filename]
                    await fs.promises.writeFile(
                        filepath,
                        typeof fileContents === 'string'
                            ? fileContents
                            : new Uint8Array(fileContents)
                    )
                    written.push(filepath)
                }
                break
        }
        written.forEach((filepath) => {
            console.log(`Created file ` + colors.bold(filepath))
        })

        if (outFormat === 'appTemplate') {
            console.log(
                colors.grey(
                    '\nWeb app compiled ! Start it by running :\n'
                ) +
                    colors.blue(`npx http-server ${outDir}\n`) +
                    colors.grey('then go to http://localhost:8080\n')
            )
        }
    }
    return task
}

const makeCliAbstractionLoader = (rootDirPath: string): AbstractionLoader =>
    makeAbstractionLoader(async (nodeType: PdJson.NodeType) => {
        const filepath = path.resolve(rootDirPath, `${nodeType}.pd`)
        let fileStats: fs.Stats | null = null
        try {
            fileStats = await fs.promises.stat(filepath)
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                throw new UnknownNodeTypeError(nodeType)
            }
            throw err
        }
        if (!fileStats || !fileStats.isFile()) {
            throw new UnknownNodeTypeError(nodeType)
        }
        return (await fs.promises.readFile(filepath)).toString()
    })

const executeTask = async (task: Task, settings: Settings): Promise<Task> => {
    const { inFilepath, inFormat, outFormat } = task
    const inString = await fs.promises.readFile(inFilepath)
    const artefacts = preloadArtefact(task.artefacts, inString, inFormat)
    const buildSteps = listBuildSteps(inFormat, outFormat)
    ifConditionThenExitError(
        buildSteps === null,
        `Not able to convert from ${inFormat} to ${outFormat}`
    )
    // Remove first step as it corresponds with the input file.
    for (let buildStep of buildSteps!) {
        consoleLogHeader(`Building ${buildStep}`)
        const result = await performBuildStep(artefacts, buildStep, settings)
        result.warnings.forEach((message) =>
            console.warn('WARNING : ' + message)
        )
        if (result.status === 1) {
            result.errors.forEach((message) =>
                console.error('ERROR : ' + message)
            )
            consoleLogEm(`FAILED`)
            process.exit(1)
        } else {
            consoleLogEm(`SUCCESS`)
        }
    }
    return { ...task, artefacts }
}

const ifConditionThenExitError = (test: boolean, msg: string) => {
    if (test) {
        exitError(msg)
    }
}

const exitError = (msg: string) => {
    console.error(msg)
    process.exit(1)
}

const main = (): void => {
    console.log('')
    const cliHeader = `~ WebPd compiler ${packageInfo.version} ~`
    console.log((colors as any).brightMagenta.bold(cliHeader))
    console.log(
        (colors as any).brightMagenta.bold(
            Array.from(cliHeader)
                .map((_) => '~')
                .join('')
        )
    )

    program
        .version(packageInfo.version)
        .option(
            '-i, --input <filename>',
            'Set the input file. Formats supported : ' +
                '\n.pd - Pure Data text file.' +
                '\n.wasm - Web Assembly module compiled with the WebPd compiler.\n|'
        )
        .option(
            '-o, --output <filename>',
            'Select an output. Available formats :' +
                '\n.wasm - Web Assembly WebPd module.' +
                '\n.js - JavaScript WebPd module.' +
                '\n.html - Complete web app embedding your compiled WebPd patch.\n|'
        )
        .option('--check-support')
        .option('--whats-implemented')

    program.showHelpAfterError('(add --help for additional information)')

    program.parse()
    const options = program.opts()

    const inFilepath: string | null = options.input || null
    const outFilepath: string | null = options.output || null
    const artefacts: Artefacts = {}

    ifConditionThenExitError(
        !!outFilepath && !inFilepath,
        `Please provide an input file with --input option.`
    )

    if (options.whatsImplemented) {
        whatsImplemented()
    }

    if (inFilepath) {
        const inFormat = guessFormat(inFilepath)
        if (!assertValidFormat(inFormat, inFilepath)) {
            return
        }

        let outFormat: BuildFormat | null = null

        if (outFilepath) {
            const guessedFormat = guessFormat(outFilepath)
            if (guessedFormat === null) {
                return exitError(`Couldn't guess format for ${outFilepath}`)
            }
            outFormat = guessedFormat
            assertValidFormat(outFormat, outFilepath)
        }

        if (options.checkSupport) {
            ifConditionThenExitError(
                !!outFilepath,
                `Option --output is incompatible with --check-support`
            )
            ifConditionThenExitError(
                inFormat !== 'pd',
                `Option --check-support requires .pd input`
            )
            outFormat = outFormat || 'pdJson'
        }

        const abstractionLoader = makeCliAbstractionLoader(
            path.dirname(inFilepath)
        )

        const settings: Settings = {
            nodeBuilders: NODE_BUILDERS,
            nodeImplementations: NODE_IMPLEMENTATIONS,
            audioSettings: {
                bitDepth: BIT_DEPTH,
                channelCount: CHANNEL_COUNT,
                sampleRate: SAMPLE_RATE,
                blockSize: BLOCK_SIZE,
                previewDurationSeconds: WAV_PREVIEW_DURATION,
            },
            abstractionLoader,
        }

        const task: Task = {
            inFilepath,
            outFilepath,
            inFormat,
            outFormat: outFormat || 'wasm',
            artefacts,
        }

        executeTask(task, settings)
            .then((task) => writeOutFile(task))
            .then((task) => {
                if (options.checkSupport && task.artefacts.pdJson) {
                    return checkSupportPdJson(
                        task.artefacts.pdJson,
                        abstractionLoader,
                        settings
                    )
                } else {
                    return null
                }
            })
            .catch((err) => {
                console.error(err)
            })
            .finally(() => {
                console.log('')
                console.log(
                    (colors as any).brightMagenta.bold(
                        Array.from(cliHeader)
                            .map((_) => '~')
                            .join('')
                    )
                )
                console.log('')
            })
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main()
}
