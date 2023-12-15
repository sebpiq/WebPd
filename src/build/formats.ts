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
export type BuildFormat = keyof typeof BUILD_FORMATS
export type BuildTree = Array<BuildFormat | BuildTree>

export const BUILD_FORMATS = {
    pd: {
        extensions: ['.pd'],
        description: 'Pure Data text',
    },
    pdJson: {
        extensions: ['.pd.json'],
        description: 'Pure Data JSON',
    },
    dspGraph: {
        extensions: ['.dsp-graph.json'],
        description: 'WebPd DSP graph',
    },
    javascript: {
        extensions: ['.js'],
        description: 'JavaScript WebPd module',
    },
    assemblyscript: {
        extensions: ['.asc'],
        description: 'AssemblyScript DSP code',
    },
    wasm: {
        extensions: ['.wasm'],
        description: 'Web Assembly WebPd module',
    },
    wav: {
        extensions: ['.wav'],
        description: 'An audio preview of your patch',
    },
    app: {
        extensions: [] as Array<string>,
        description: 'Complete web app embedding your compiled WebPd patch',
    },
}

export const BUILD_TREE: BuildTree = [
    'pd',
    'pdJson',
    'dspGraph',
    [
        ['javascript', 'wav'],
        ['assemblyscript', 'wasm', 'wav'],
        ['assemblyscript', 'wasm', 'app'],
        ['javascript', 'app'],
    ],
]

export const guessFormat = (filepath: string): BuildFormat | null => {
    const formats = Object.entries(BUILD_FORMATS).filter(([_, specs]) => {
        if (specs.extensions.some((extension) => filepath.endsWith(extension))) {
            return true
        }
        return false
    })
    if (formats.length === 0) {
        return null
    }
    return formats[0][0] as BuildFormat
}

export const listBuildSteps = (
    inFormat: BuildFormat,
    outFormat: BuildFormat,
    intermediateStep?: BuildFormat
): Array<BuildFormat> => {
    let paths = _findBuildPaths(BUILD_TREE, outFormat, [])
        .filter((path) => path.includes(inFormat))
        .map((path) => path.slice(path.indexOf(inFormat) + 1))

    if (intermediateStep && intermediateStep !== inFormat) {
        paths = paths.filter((path) => path.includes(intermediateStep))
    }

    if (paths.length === 0) {
        return null
    }
    return paths[0]
}

export const listOutputFormats = (inFormat: BuildFormat): Set<BuildFormat> => new Set(
    _traverseBuildTree(BUILD_TREE, [])
        .filter((path) => path.includes(inFormat))
        .map((path) => path.slice(path.indexOf(inFormat) + 1))
        .flat()
)

export const _findBuildPaths = (
    branch: BuildTree,
    target: BuildFormat,
    parentPath: Array<BuildFormat>
): Array<Array<BuildFormat>> => {
    let path: Array<BuildFormat> = [...parentPath]
    return branch.flatMap((node) => {
        if (Array.isArray(node)) {
            return _findBuildPaths(node, target, path)
        }
        path = [...path, node]
        if (node === target) {
            return [path]
        }
        return []
    })
}

export const _traverseBuildTree = (
    branch: BuildTree,
    parentPath: Array<BuildFormat>
): Array<Array<BuildFormat>> => {
    let path: Array<BuildFormat> = [...parentPath]
    return branch.flatMap((node, i) => {
        if (Array.isArray(node)) {
            return _traverseBuildTree(node, path)
        }
        path = [...path, node]
        if (i === branch.length - 1) {
            return [path]
        }
        return []
    })
}