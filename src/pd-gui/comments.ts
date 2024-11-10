/*
 * Copyright (c) 2022-2025 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
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
import { PdJson } from "@webpd/pd-parser"
import { getRootPatch } from "./utils"
import { Comment } from "./types"


export const discoverPdGuiComments = (pdJson: PdJson.Pd) => {
    const rootPatch = getRootPatch(pdJson)
    return Object.values(rootPatch.nodes)
        .filter((node) => node.type === 'text')
        .map((node) => {
            const comment: Comment = {
                type: 'comment',
                patch: rootPatch,
                node,
                text: node.args[0]!.toString(),
            }
            return comment
        })
}