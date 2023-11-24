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

import { AnonFunc, Var } from '@webpd/compiler'
import { VariableName } from '@webpd/compiler/src/ast/types'

export const coldFloatInlet = (
    storageName: VariableName,
) => {
    return AnonFunc([Var('Message', 'm')])`
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${storageName} = msg_readFloatToken(m, 0)
            return
        }
    `
}

export const coldStringInlet = (
    storageName: VariableName,
) => {
    return AnonFunc([Var('Message', 'm')])`
        if (msg_isMatching(m, [MSG_STRING_TOKEN])) {
            ${storageName} = msg_readStringToken(m, 0)
            return
        }
    `
}

export const coldFloatInletWithSetter = (
    setterName: VariableName,
    state: VariableName,
) => {
    return AnonFunc([Var('Message', 'm')])`
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${setterName}(${state}, msg_readFloatToken(m, 0))
            return
        }
    `
}
