import colors from 'colors/safe'
import packageInfo from './package.json'
import asc from 'assemblyscript/dist/asc.js'
import { PdJson } from '@webpd/pd-parser'
import { program } from 'commander'
import * as path from 'path'
import fs from 'fs'
import {
    Artefacts,
    BuildFormat,
    BUILD_FORMATS,
    Settings,
} from './src/build/types'
import { setAsc } from './src/build/asc'
import { analysePd } from './src/build/reports'
import {
    performBuildStep,
    listBuildSteps,
    preloadArtefact,
    guessFormat,
} from './src/build/build'
import {
    getArtefact,
    makeAbstractionLoader,
    UnknownNodeTypeError,
} from './src/build/helpers'
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
    process.stdout.write('\n~~~ ' + colors.bold(message))

const consoleLogEm = (message: string) =>
    process.stdout.write(colors.bold(message))

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
        process.stdout.write(
            `\n${
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
        process.stdout.write(colors.green(`\n✓ (supported)`))
    } else {
        process.stdout.write(colors.red(`\n✘ (not supported)`))
    }
}

const whatsImplemented = () => {
    consoleLogHeader(`What's implemented ?`)
    process.stdout.write(
        `\n${
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
    const { outFilepath, outFormat, artefacts } = task
    const written: Array<string> = []
    if (outFormat && outFilepath) {
        consoleLogEm(`\nGenerating output`)
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
                for (let filename of Object.keys(appTemplate)) {
                    const filepath = path.resolve(outFilepath, filename)
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
            process.stdout.write(`\nCreated file ` + colors.bold(filepath))
        })

        if (outFormat === 'appTemplate') {
            process.stdout.write(
                colors.grey('\n\nWeb app compiled ! Start it by running :\n') +
                    colors.blue(`\tnpx http-server ${outFilepath}\n`)
            )
        }
    }
    return task
}

const makeCliAbstractionLoader = (rootDirPath: string): AbstractionLoader =>
    makeAbstractionLoader(async (nodeType: PdJson.NodeType) => {
        const filepath = path.resolve(rootDirPath, `${nodeType}.pd`)
        if (!isFileSync(filepath)) {
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
        consoleLogHeader(`Building ${buildStep} `)
        const result = await performBuildStep(artefacts, buildStep, settings)
        if (result.status === 0) {
            process.stdout.write(colors.green(`✓`))
        } else {
            process.stdout.write(colors.red(`✘ (failed)`))
        }

        result.warnings.forEach((message) =>
            process.stdout.write(colors.grey('\nWARNING : ' + message))
        )
        if (result.status === 1) {
            result.errors.forEach((message) =>
                process.stderr.write('\n' + colors.red('ERROR : ' + message))
            )
            process.stdout.write(`\n`)
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
    process.stderr.write('\n' + msg + '\n\n')
    program.outputHelp({ error: true })
    process.exit(1)
}

const pathStatsSync = (filepath: string) => {
    try {
        return fs.statSync(filepath)
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return null
        }
        throw err
    }
}

const isDirectorySync = (filepath: string) => {
    let fileStats: fs.Stats | null = pathStatsSync(filepath)
    if (!fileStats) {
        return false
    } else {
        return fileStats.isDirectory()
    }
}

const isFileSync = (filepath: string) => {
    let fileStats: fs.Stats | null = pathStatsSync(filepath)
    if (!fileStats) {
        return false
    } else {
        return fileStats.isFile()
    }
}

const main = (): void => {
    process.stdout.write(
        (colors as any).brightMagenta.bold(`~ WebPd ${packageInfo.version} ~`)
    )
    process.stdout.write(colors.grey('\nLicensed under LGPL V3\n'))

    program
        .version(packageInfo.version)
        .option(
            '-i, --input <filename>',
            'Set the input file. Extensions supported : ' +
                (['pd', 'wasm'] as Array<BuildFormat>).map(
                    (format) =>
                        `\n${BUILD_FORMATS[format].extensions.join(', ')} - ${BUILD_FORMATS[format].description}`
                ).join('')
        )
        .option(
            '-o, --output <path>',
            'Select a file path or directory for output.'
        )
        .option(
            '-f, --output-format <format>',
            'Select an output format. If not provided, the format will be inferred from output filename. Available formats :' +
                (
                    [
                        'wasm',
                        'compiledJs',
                        'appTemplate',
                        'wav',
                    ] as Array<BuildFormat>
                ).map(
                    (format) =>
                        `\n${format} - ${BUILD_FORMATS[format].description}`
                ).join('')
        )
        .option('--check-support')
        .option('--whats-implemented')

    program.addHelpText(
        'after',
        (colors as any).brightMagenta('\n~ Usage examples ~') +
            '\nGenerating a web page embedding myPatch.pd in path/to/folder : ' +
            colors.blue('\nwebpd -i myPatch.pd -o path/to/folder -f appTemplate') +
            '\nGenerating a wav preview of myPatch.pd : ' +
            colors.blue('\nwebpd -i myPatch.pd -o myPatch.wav')
    )
    program.showHelpAfterError('(add --help for additional information)')

    if (process.argv.length < 3) {
        program.outputHelp()
        process.exit(0)
    }

    program.parse()
    const options = program.opts()

    const inFilepath: string | null = options.input || null
    const outFilepath: string | null = options.output || null
    let outFormat: BuildFormat | null = options.outputFormat || null
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

        if (!outFormat && outFilepath) {
            const guessedFormat = guessFormat(outFilepath)
            if (guessedFormat === null) {
                return exitError(
                    `Unknown or unsupported format for ${outFilepath} consider using the --output-format option`
                )
            }
            outFormat = guessedFormat
            assertValidFormat(outFormat, outFilepath)
        }

        ifConditionThenExitError(
            outFormat === 'appTemplate' && !isDirectorySync(outFilepath),
            `Generating an app requires output path to be a directory`
        )

        if (options.checkSupport) {
            ifConditionThenExitError(
                !!outFilepath || !!outFormat,
                `Option --output is incompatible with --check-support`
            )
            ifConditionThenExitError(
                inFormat !== 'pd',
                `Option --check-support requires .pd input`
            )
            outFormat = outFormat || 'pdJson'

        } else if (!outFilepath) {
            exitError('Please specify an ouput using -o option.')
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
                throw err
                process.stderr.write('\n' + err)
            })
            .finally(() => {
                process.stdout.write(
                    (colors as any).brightMagenta.bold('\n~ done ~\n')
                )
            })
    }
}

// NOTE : if (process.argv[1] === fileURLToPath(import.meta.url))
// not working apparently when installing executable with npm.
main()