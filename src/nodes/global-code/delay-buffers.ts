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
import { coreCode } from '@webpd/compiler'
import { GlobalCodeGeneratorWithSettings } from '@webpd/compiler/src/types'

// TODO : how to safely declare a global variable without clashing
export const delayBuffers: GlobalCodeGeneratorWithSettings = {
    codeGenerator: ({ macros: { Var, Func } }) => `
    const ${Var('DELAY_BUFFERS', 'Map<string, buf_SoundBuffer>')} = new Map()
    const ${Var('DELAY_BUFFERS_SKEDULER', 'Skeduler')} = sked_create(true)
    const ${Var('DELAY_BUFFERS_NULL', 'buf_SoundBuffer')} = buf_create(1)

    function DELAY_BUFFERS_set ${Func(
        [Var('delayName', 'string'), Var('buffer', 'buf_SoundBuffer')],
        'void'
    )} {
        DELAY_BUFFERS.set(delayName, buffer)
        sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
    }

    function DELAY_BUFFERS_get ${Func(
        [
            Var('delayName', 'string'),
            Var('callback', '(event: string) => void'),
        ],
        'void'
    )} {
        sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
    }

    function DELAY_BUFFERS_delete ${Func(
        [Var('delayName', 'string')],
        'void'
    )} {
        DELAY_BUFFERS.delete(delayName)
    }
`,
    dependencies: [coreCode.bufCore, coreCode.sked],
}
