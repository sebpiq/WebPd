import { Artefacts } from '../api/types'

export const WEBPD_RUNTIME_FILENAME = 'webpd-runtime.js'

export interface Settings {
    artefacts: Artefacts
}

export type GeneratedApp = { [filename: string]: string | ArrayBuffer }
