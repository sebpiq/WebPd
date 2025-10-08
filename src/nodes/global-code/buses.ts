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
import { GlobalDefinitions } from '@webpd/compiler'
import { stdlib, Sequence, ConstVar, Var, Func } from '@webpd/compiler'

export const sigBuses: GlobalDefinitions = {
    namespace: 'sigBuses',
    // prettier-ignore
    code: ({ ns: sigBuses }) => Sequence([
        ConstVar(`Map<string, Float>`, sigBuses._BUSES, `new Map()`),
        `${sigBuses._BUSES}.set('', 0)`,

        Func(sigBuses.addAssign, [
            Var(`string`, `busName`), 
            Var(`Float`, `value`)
        ], 'Float')`
            ${ConstVar(
                'Float', 
                'newValue', 
                `${sigBuses._BUSES}.get(busName) + value`
            )}
            ${sigBuses._BUSES}.set(
                busName,
                newValue,
            )
            return newValue
        `,

        Func(sigBuses.set, [
            Var(`string`, `busName`), 
            Var(`Float`, `value`),
        ], 'void')`
            ${sigBuses._BUSES}.set(
                busName,
                value,
            )
        `,

        Func(sigBuses.reset, [
            Var(`string`, `busName`)
        ], 'void')`
            ${sigBuses._BUSES}.set(busName, 0)
        `,

        Func(sigBuses.read, [
            Var(`string`, `busName`)
        ], 'Float')`
            return ${sigBuses._BUSES}.get(busName)
        `
    ]),
}

export const msgBuses: GlobalDefinitions = {
    namespace: 'msgBuses',
    // prettier-ignore
    code: ({ ns: msgBuses }, { msg }) => Sequence([
        ConstVar(
            `Map<string, Array<${msg.Handler}>>`,
            msgBuses._BUSES,
            'new Map()'
        ),

        Func(msgBuses.publish, [
            Var(`string`, `busName`), 
            Var(msg.Message, `message`)
        ], 'void')`
            ${Var(`Int`, `i`, `0`)}
            ${ConstVar(
                `Array<${msg.Handler}>`,
                'callbacks',
                `${msgBuses._BUSES}.has(busName) ? ${msgBuses._BUSES}.get(busName): []`
            )}
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        `,

        Func(msgBuses.subscribe, [
            Var(`string`, `busName`), 
            Var(msg.Handler, `callback`)
        ], 'void')`
            if (!${msgBuses._BUSES}.has(busName)) {
                ${msgBuses._BUSES}.set(busName, [])
            }
            ${msgBuses._BUSES}.get(busName).push(callback)
        `,

        Func(msgBuses.unsubscribe, [
            Var(`string`, `busName`), 
            Var(msg.Handler, `callback`)
        ], 'void')`
            if (!${msgBuses._BUSES}.has(busName)) {
                return
            }
            ${ConstVar(`Array<${msg.Handler}>`, `callbacks`, `${msgBuses._BUSES}.get(busName)`)}
            ${ConstVar(`Int`, `found`, `callbacks.indexOf(callback)`)}
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
        `
    ]),

    dependencies: [stdlib.msg],
}
