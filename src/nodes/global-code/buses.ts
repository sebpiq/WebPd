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
import {
    GlobalCodeGenerator,
    GlobalCodeGeneratorWithSettings,
} from '@webpd/compiler/src/compile/types'
import { stdlib } from '@webpd/compiler'
import { Sequence, ConstVar, Var, Func } from '@webpd/compiler'

// TODO : unit tests
export const signalBuses: GlobalCodeGenerator = () => 
    Sequence([
        ConstVar('Map<string, Float>', 'SIGNAL_BUSES', 'new Map()'),
        `SIGNAL_BUSES.set('', 0)`,

        Func('addAssignSignalBus', [
            Var('string', 'busName'), 
            Var('Float', 'value')
        ], 'Float')`
            ${ConstVar('Float', 'newValue', 'SIGNAL_BUSES.get(busName) + value')}
            SIGNAL_BUSES.set(
                busName,
                newValue,
            )
            return newValue
        `,

        Func('setSignalBus', [
            Var('string', 'busName'), 
            Var('Float', 'value'),
        ], 'void')`
            SIGNAL_BUSES.set(
                busName,
                value,
            )
        `,

        Func('resetSignalBus', [
            Var('string', 'busName')
        ], 'void')`
            SIGNAL_BUSES.set(busName, 0)
        `,

        Func('readSignalBus', [Var('string', 'busName')], 'Float')`
            return SIGNAL_BUSES.get(busName)
        `
    ])

// TODO : unit tests
export const messageBuses: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => Sequence([
        ConstVar(
            'Map<string, Array<(m: Message) => void>>',
            'MSG_BUSES',
            'new Map()'
        ),

        Func('msgBusPublish', 
            [Var('string', 'busName'), Var('Message', 'message')],
            'void'
        )`
            ${Var('Int', 'i', '0')}
            ${ConstVar(
                'Array<(m: Message) => void>',
                'callbacks',
                'MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []'
            )}
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        `,

        Func('msgBusSubscribe', 
            [Var('string', 'busName'), Var('(m: Message) => void', 'callback')],
            'void'
        )`
            if (!MSG_BUSES.has(busName)) {
                MSG_BUSES.set(busName, [])
            }
            MSG_BUSES.get(busName).push(callback)
        `,

        Func('msgBusUnsubscribe', 
            [Var('string', 'busName'), Var('(m: Message) => void', 'callback')],
            'void'
        )`
            if (!MSG_BUSES.has(busName)) {
                return
            }
            ${ConstVar('Array<(m: Message) => void>', 'callbacks', 'MSG_BUSES.get(busName)')}
            ${ConstVar('Int', 'found', 'callbacks.indexOf(callback) !== -1')}
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
        `
    ]),

    dependencies: [stdlib.msg],
}
