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
} from '@webpd/compiler/src/types'
import { coreCode } from '@webpd/compiler'

// TODO : unit tests
export const signalBuses: GlobalCodeGenerator = ({ macros: { Var, Func } }) => `
    const ${Var('SIGNAL_BUSES', 'Map<string, Float>')} = new Map()
    SIGNAL_BUSES.set('', 0)

    function addAssignSignalBus ${Func(
        [Var('busName', 'string'), Var('value', 'Float')],
        'Float'
    )} {
        const ${Var('newValue', 'Float')} = SIGNAL_BUSES.get(busName) + value
        SIGNAL_BUSES.set(
            busName,
            newValue,
        )
        return newValue
    }

    function setSignalBus ${Func([
        Var('busName', 'string'), 
        Var('value', 'Float'),
    ], 'void')} {
        SIGNAL_BUSES.set(
            busName,
            value,
        )
    }

    function resetSignalBus ${Func([
        Var('busName', 'string')
    ], 'void')} {
        SIGNAL_BUSES.set(busName, 0)
    }

    function readSignalBus ${Func([Var('busName', 'string')], 'Float')} {
        return SIGNAL_BUSES.get(busName)
    }
`

// TODO : unit tests
export const messageBuses: GlobalCodeGeneratorWithSettings = {
    codeGenerator: ({ macros: { Var, Func } }) => `
    const ${Var(
        'MSG_BUSES',
        'Map<string, Array<(m: Message) => void>>'
    )} = new Map()

    function msgBusPublish ${Func(
        [Var('busName', 'string'), Var('message', 'Message')],
        'void'
    )} {
        let ${Var('i', 'Int')} = 0
        const ${Var(
            'callbacks',
            'Array<(m: Message) => void>'
        )} = MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []
        for (i = 0; i < callbacks.length; i++) {
            callbacks[i](message)
        }
    }

    function msgBusSubscribe ${Func(
        [Var('busName', 'string'), Var('callback', '(m: Message) => void')],
        'void'
    )} {
        if (!MSG_BUSES.has(busName)) {
            MSG_BUSES.set(busName, [])
        }
        MSG_BUSES.get(busName).push(callback)
    }

    function msgBusUnsubscribe ${Func(
        [Var('busName', 'string'), Var('callback', '(m: Message) => void')],
        'void'
    )} {
        if (!MSG_BUSES.has(busName)) {
            return
        }
        const ${Var(
            'callbacks',
            'Array<(m: Message) => void>'
        )} = MSG_BUSES.get(busName)
        const ${Var('found', 'Int')} = callbacks.indexOf(callback) !== -1
        if (found !== -1) {
            callbacks.splice(found, 1)
        }
    }
`,
    dependencies: [coreCode.msg],
}
