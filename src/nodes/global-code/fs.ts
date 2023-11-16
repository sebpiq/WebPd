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
import { stdlib } from '@webpd/compiler'
import { ConstVar, Func, Var } from '@webpd/compiler'
import { GlobalCodeGeneratorWithSettings } from '@webpd/compiler/src/compile/types'

// TODO : support for -raw (see soundfiler help)
// TODO : find a better way to factorize this code
// TODO : unit testing
export const parseSoundFileOpenOpts: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => 
        Func('parseSoundFileOpenOpts', 
            [Var('Message', 'm'), Var('fs_SoundInfo', 'soundInfo')],
            'Set<Int>'
        )`
            ${ConstVar('Set<Int>', 'unhandled', 'new Set()')}
            ${Var('Int', 'i', '0')}
            while (i < msg_getLength(m)) {
                if (msg_isStringToken(m, i)) {
                    ${ConstVar('string', 'str', 'msg_readStringToken(m, i)')}
                    if (['-wave', '-aiff', '-caf', '-next', '-ascii'].includes(str)) {
                        soundInfo.encodingFormat = str.slice(1)

                    } else if (str === '-raw') {
                        console.log('-raw format not yet supported')
                        i += 4
                        
                    } else if (str === '-big') {
                        soundInfo.endianness = 'b'

                    } else if (str === '-little') {
                        soundInfo.endianness = 'l'

                    } else if (str === '-bytes') {
                        if (i < msg_getLength(m) && msg_isFloatToken(m, i + 1)) {
                            soundInfo.bitDepth = toInt(msg_readFloatToken(m, i + 1) * 8)
                            i++
                        } else {
                            console.log('failed to parse -bytes <value>')
                        }

                    } else if (str === '-rate') {
                        if (i < msg_getLength(m) && msg_isFloatToken(m, i + 1)) {
                            soundInfo.sampleRate = toInt(msg_readFloatToken(m, i + 1))
                            i++
                        } else {
                            console.log('failed to parse -rate <value>')
                        }

                    } else {
                        unhandled.add(i)
                    }
                    
                } else {
                    unhandled.add(i)
                }
                i++
            }
            return unhandled
        `
    ,
    dependencies: [stdlib.msg, stdlib.fsCore],
}

// TODO : unit testing
export const parseReadWriteFsOpts: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => 
        Func('parseReadWriteFsOpts', 
            [
                Var('Message', 'm'),
                Var('fs_SoundInfo', 'soundInfo'),
                Var('Set<Int>', 'unhandledOptions'),
            ],
            'string'
        )`
            // Remove the "open" token
            unhandledOptions.delete(0)

            ${Var('string', 'url', '""')}
            ${Var('boolean', 'urlFound', 'false')}
            ${Var('boolean', 'errored', 'false')}
            ${Var('Int', 'i', '1')}
            while (i < msg_getLength(m)) {
                if (!unhandledOptions.has(i)) {

                } else if (msg_isStringToken(m, i)) {
                    url = msg_readStringToken(m, i)
                    urlFound = true

                } else {
                    console.log("[writesf/readsf~] invalid option index " + i.toString())
                    errored = true
                }
                i++
            }
            if (!urlFound) {
                console.log("[writesf/readsf~] invalid options, file url not found")
                return ''
            }
            if (errored) {
                return ''
            }
            return url
        `
    ,
    dependencies: [stdlib.msg, stdlib.fsCore],
}
