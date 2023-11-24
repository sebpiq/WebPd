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
import { ConstVar, Func, Sequence, Var } from '@webpd/compiler'
import { GlobalCodeGeneratorWithSettings } from '@webpd/compiler/src/compile/types'

// TODO : how to safely declare a global variable without clashing
export const delayBuffers: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => Sequence([
        ConstVar('Map<string, buf_SoundBuffer>', 'DELAY_BUFFERS', 'new Map()'),
        ConstVar('Skeduler', 'DELAY_BUFFERS_SKEDULER', 'sked_create(true)'),
        ConstVar('buf_SoundBuffer', 'DELAY_BUFFERS_NULL', 'buf_create(1)'),
    
        Func('DELAY_BUFFERS_set', 
            [Var('string', 'delayName'), Var('buf_SoundBuffer', 'buffer')],
            'void'
        )`
            DELAY_BUFFERS.set(delayName, buffer)
            sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
        `,
    
        Func('DELAY_BUFFERS_get', 
            [
                Var('string', 'delayName'),
                Var('SkedCallback', 'callback'),
            ],
            'void'
        )`
            sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
        `,
    
        Func('DELAY_BUFFERS_delete', 
            [Var('string', 'delayName')],
            'void'
        )`
            DELAY_BUFFERS.delete(delayName)
        `,
    ])
,
    dependencies: [stdlib.bufCore, stdlib.sked],
}
