import { fileURLToPath } from 'url'
import asc from 'assemblyscript/dist/asc.js'
import parse, { PdJson } from '@webpd/pd-parser'
import { program } from 'commander'
import * as path from 'path'
import fs from 'fs'
import { Artefacts, Format, FORMATS, Settings } from './api/types'
import { setAsc } from './api/asc'
import { analysePd } from './api/reports'
import {
    buildArtefact,
    findBuildSteps,
    preloadArtefact,
} from './api/artefacts'
import { getArtefact, makeParseErrorMessages } from './api/helpers'
import { AbstractionLoader } from './compile-dsp-graph/instantiate-abstractions'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from './compile-dsp-graph/nodes-index'
setAsc(asc)

const BIT_DEPTH = 64
const BLOCK_SIZE = 1024 * 8
const SAMPLE_RATE = 44100
const CHANNEL_COUNT = { in: 2, out: 2 }
const WAV_PREVIEW_DURATION = 15

interface Task {
    inFilepath: string
    inFormat: Format
    outFilepath: string | null
    outFormat: Format
    artefacts: Artefacts
}

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
    console.log(`> Check support `)
    if (unimplementedObjectTypes.size) {
        console.log(
            `\t ${
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
        console.log(`\t Supported : YES`)
    } else {
        console.log(`\t Supported : NO`)
    }
    console.log('')
}

const whatsImplemented = () => {
    console.log(`> What's implemented ?`)
    console.log(
        `\t ${
            Object.keys(NODE_BUILDERS).length
        } object implemented : ${Object.keys(NODE_BUILDERS)
            .map((type) => `[${type}]`)
            .join(', ')}`
    )
    console.log('')
}

const getExtension = (filepath: string) => {
    let extension = path.extname(filepath)
    const extensions: Array<string> = []
    while (extension && filepath) {
        extensions.unshift(extension)
        filepath = path.basename(filepath, extension)
        extension = path.extname(filepath)
    }
    return extensions.join('')
}

const guessFormat = (filepath: string): Format | null => {
    const extension = getExtension(filepath)
    const formats = Object.entries(FORMATS).filter(([_, specs]) => {
        if (specs.extensions.includes(extension)) {
            return true
        }
        return false
    })
    if (formats.length === 0) {
        return null
    }
    return formats[0][0] as Format
}

const assertValidFormat = (
    format: Format | null,
    filepath: string
): format is Format => {
    ifConditionThenExitError(
        format === null,
        `Unknown input file format for ${filepath}`
    )
    return true
}

const writeOutFile = async (task: Task): Promise<Task> => {
    const { outFilepath, outFormat, artefacts } = task
    if (outFormat && outFilepath) {
        switch (outFormat) {
            case 'pdJson':
            case 'dspGraph':
                await fs.promises.writeFile(
                    outFilepath!,
                    JSON.stringify(getArtefact(artefacts, outFormat), null, 2)
                )
                break

            case 'compiledJs':
            case 'compiledAsc':
                await fs.promises.writeFile(
                    outFilepath!,
                    getArtefact(artefacts, outFormat)
                )
                break

            case 'wasm':
                await fs.promises.writeFile(
                    outFilepath!,
                    Buffer.from(getArtefact(artefacts, outFormat))
                )
                break

            case 'wav':
                await fs.promises.writeFile(
                    outFilepath!,
                    getArtefact(artefacts, outFormat)
                )
                break
        }
    }
    console.log(`output file written to ${outFilepath}`)
    return task
}

const makeAbstractionLoader =
    (rootDirPath: string) => async (nodeType: PdJson.NodeType) => {
        const filepath = path.resolve(rootDirPath, `${nodeType}.pd`)
        let fileStats: fs.Stats | null = null
        try {
            fileStats = await fs.promises.stat(filepath)
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                return null
            }
            throw err
        }
        if (!fileStats || !fileStats.isFile()) {
            return null
        }
        const pd = (await fs.promises.readFile(filepath)).toString()
        const parseResult = parse(pd)
        if (parseResult.status === 0) {
            return parseResult.pd
        } else {
            console.error(`failed to parse abstraction [${nodeType}] at ${filepath}`)
            makeParseErrorMessages(parseResult.errors).forEach((message) =>
                console.error(message)
            )
            return null
        }
    }

const executeTask = async (task: Task, settings: Settings): Promise<Task> => {
    const { inFilepath, inFormat, outFormat } = task
    const inString = await fs.promises.readFile(inFilepath)
    const artefacts = preloadArtefact(task.artefacts, inString, inFormat)
    const buildSteps = findBuildSteps(inFormat, outFormat)
    ifConditionThenExitError(
        buildSteps === null,
        `Not able to convert from ${inFormat} to ${outFormat}`
    )
    // Remove first step as it corresponds with the input file.
    for (let buildStep of buildSteps!.slice(1)) {
        const result = await buildArtefact(artefacts, buildStep, settings)
        if (result.status === 0 && result.warnings) {
            result.warnings.forEach((message) => console.warn(message))
        } else if (result.status === 1) {
            if (result.errors) {
                result.errors.forEach((message) => console.warn(message))
            }
            process.exit(1)
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
    program
        .option('-i, --input <filename>')
        .option('-o, --output <filename>')
        .option('--check-support')
        .option('--whats-implemented')

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

        let outFormat: Format | null = null

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
            abstractionLoader: makeAbstractionLoader(path.dirname(inFilepath)),
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
                        makeAbstractionLoader(path.dirname(inFilepath)),
                        settings
                    )
                } else {
                    return null
                }
            })
            .then(() => {
                console.log('DONE !')
            })
            .catch((err) => {
                console.error(err)
            })
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main()
}
