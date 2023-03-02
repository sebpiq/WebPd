import { Settings } from './types'

let ASC: any = null
export const setAsc = (asc: any) => ASC = asc

export const compileAsc = async (
    code: string,
    bitDepth: Settings['audioSettings']['bitDepth']
): Promise<ArrayBuffer> => {
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