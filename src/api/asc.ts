import { Settings } from './types'

let ASC: any = null

/** 
 * This function sets the assemblyscript compiler so that WebPd can use it. 
 * The assemblyscript compiler is quite heavy and causes problems with bundling.
 * Also, depending on the host environment (web or node), it is loaded differently.
 * Therefore we leave it to the user to load it themselves and then pass the loaded
 * instance to WebPd.
 */
export const setAsc = (asc: any) => ASC = asc

export const compileAsc = async (
    code: string,
    bitDepth: Settings['audioSettings']['bitDepth']
): Promise<ArrayBuffer> => {
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