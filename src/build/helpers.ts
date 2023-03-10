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