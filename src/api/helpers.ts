import { Artefacts, BuildFormat } from "./types"

export const getArtefact = <K extends BuildFormat>(
    artefacts: Artefacts,
    outFormat: K
) => {
    const artefact = artefacts[outFormat]
    if (!artefact) {
        throw new Error(`no artefact was generated for ${outFormat}`)
    }
    return artefact
}

export const makeParseErrorMessages = (
    errorOrWarnings: Array<{ message: string; lineIndex: number }>
) =>
    errorOrWarnings.map(
        ({ message, lineIndex }) => `line ${lineIndex} : ${message}`
    )

export const stringifyArrayBuffer = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer)