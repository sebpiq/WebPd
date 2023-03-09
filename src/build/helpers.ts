import parse, { PdJson } from '@webpd/pd-parser'
import { AbstractionLoader } from '../compile-dsp-graph/instantiate-abstractions'
import { Artefacts, BuildFormat } from './types'

/**
 * A helper to build an abstraction loader. 
 * @param pdFileLoader takes a node type and returns the corresponding pd file.
 * If the pd file could not be found, the function must throw an UnknownNodeTypeError.
 */
export const makeAbstractionLoader =
    (
        pdFileLoader: (nodeType: PdJson.NodeType) => Promise<string>
    ): AbstractionLoader =>
    async (nodeType) => {
        let pd: string | null = null 
        
        try {
            pd = await pdFileLoader(nodeType)
        } catch(err: any) {
            if (err instanceof UnknownNodeTypeError) {
                return {
                    status: 1,
                    unknownNodeType: nodeType,
                }
            } else {
                throw err
            }
        }

        const parseResult = parse(pd)
        if (parseResult.status === 0) {
            return {
                status: 0,
                pd: parseResult.pd,
                parsingWarnings: parseResult.warnings,
            }
        } else {
            return {
                status: 1,
                parsingErrors: parseResult.errors,
                parsingWarnings: parseResult.warnings,
            }
        }
    }

export class UnknownNodeTypeError extends Error {}

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

export const stringifyArrayBuffer = (buffer: ArrayBuffer) =>
    new TextDecoder().decode(buffer)