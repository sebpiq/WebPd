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
import { fsWeb } from '@webpd/runtime'
import { urlDirName } from './url-helpers'
import { Settings } from './run'
import { Code, readMetadata as readMetadataRaw } from '@webpd/compiler'
import { WasmBuffer } from '../../build/types'

export const defaultSettingsForRun = (patchUrl: string): Settings => {
    const rootUrl = urlDirName(patchUrl)
    return {
        messageHandler: (node, message) => fsWeb(node, message, { rootUrl }),
    }
}

export const readMetadata = (compiledPatch: Code | WasmBuffer) => {
    if (typeof compiledPatch === 'string') {
        return readMetadataRaw('javascript', compiledPatch)
    } else {
        return readMetadataRaw('assemblyscript', compiledPatch)
    }
}