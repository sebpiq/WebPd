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
import { BuildSettings, WasmBuffer } from './types'

let ASC: any = null

/** 
 * This function sets the assemblyscript compiler so that WebPd can use it. 
 * The assemblyscript compiler is quite heavy and causes problems with bundling.
 * Also, depending on the host environment (web or node), it is loaded differently.
 * Therefore we leave it to the consumer to load it themselves and then pass the loaded
 * instance to WebPd.
 */
export const setAsc = (asc: any) => ASC = asc

export const compileAsc = async (
    code: string,
    bitDepth: BuildSettings['audioSettings']['bitDepth']
): Promise<WasmBuffer> => {
    if (!ASC) {
        throw new Error(`assemblyscript compiler was not set properly. Please use WebPd's setAsc function to initialize it.`)
    }
    const compileOptions: any = {
        optimizeLevel: 3,
        debug: true,
        runtime: 'incremental',
        exportRuntime: true,
        sourceMap: true,
    }
    if (bitDepth === 32) {
        // For 32 bits version of Math
        compileOptions.use = ['Math=NativeMathf']
    }
    const { error, binary, stderr } = await ASC.compileString(
        code,
        compileOptions
    )
    if (error) {
        throw new Error(stderr.toString())
    }
    return binary.buffer
}