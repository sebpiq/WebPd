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