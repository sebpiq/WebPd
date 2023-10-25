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

import { CodeVariableName } from '@webpd/compiler/src/compile/types'

export const coldFloatInlet = (
    messageName: CodeVariableName,
    storageName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${storageName} = msg_readFloatToken(${messageName}, 0)
        return
    }`
}

export const coldStringInlet = (
    messageName: CodeVariableName,
    storageName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_STRING_TOKEN])) {
        ${storageName} = msg_readStringToken(${messageName}, 0)
        return
    }`
}

export const coldFloatInletWithSetter = (
    messageName: CodeVariableName,
    setterName: CodeVariableName,
) => {
    return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${setterName}(msg_readFloatToken(${messageName}, 0))
        return
    }`
}
