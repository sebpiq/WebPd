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

import { PdJson } from '@webpd/pd-parser'
import {
    AbstractionLoader,
    UnknownNodeTypeError,
    makeAbstractionLoader,
} from '../build'
import path from 'path'
import { isFileSync } from './fs-helpers'
import fs from 'fs'

/**
 * Helper to build an abstraction loader from a root path on the file system.
 * The returned loader will :
 * - use the root path to resolve relative paths for abstractions.
 * - suffix all abstraction names with .pd if they don't already have an extension.
 *
 * @param rootUrl
 * @returns
 */
export const makeFsAbstractionLoader = (
    rootDirPath: string
): AbstractionLoader =>
    makeAbstractionLoader(async (nodeType: PdJson.NodeType) => {
        const filepath = path.resolve(
            rootDirPath,
            nodeType.endsWith('.pd') ? nodeType : `${nodeType}.pd`
        )
        if (!isFileSync(filepath)) {
            throw new UnknownNodeTypeError(nodeType)
        }
        return (await fs.promises.readFile(filepath)).toString()
    })
