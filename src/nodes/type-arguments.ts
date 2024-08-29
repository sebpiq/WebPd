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
    GlobalDefinitions,
} from '@webpd/compiler/src/compile/types'
import { ValidationError } from './validation'
import { VariableName } from '@webpd/compiler/src/ast/types'
import { Func, Var, ConstVar, VariableNamesIndex } from '@webpd/compiler'

export type TypeArgument = 'float' | 'bang' | 'symbol' | 'list' | 'anything'

const TYPE_ARGUMENTS: Array<TypeArgument> = [
    'float',
    'bang',
    'symbol',
    'list',
    'anything',
]

export const resolveTypeArgumentAlias = (value: string): string => {
    switch (value) {
        case 'f':
            return 'float'
        case 'b':
            return 'bang'
        case 's':
            return 'symbol'
        case 'l':
            return 'list'
        case 'a':
            return 'anything'
        case 'p':
            return 'pointer'
        default:
            return value
    }
}

export const assertTypeArgument = (value: string): TypeArgument => {
    if (value === 'pointer') {
        throw new ValidationError(`"pointer" not supported (yet)`)
    } else if (!TYPE_ARGUMENTS.includes(value as any)) {
        throw new ValidationError(`invalid type ${value}`)
    }
    return value as TypeArgument
}

export const renderMessageTransfer = (
    typeArgument: TypeArgument,
    msgVariableName: VariableName,
    index: number,
    { msg, bangUtils, tokenConversion }: VariableNamesIndex['globals']
) => {
    switch (typeArgument) {
        case 'float':
            return `${msg.floats}([${tokenConversion.toFloat}(${msgVariableName}, ${index})])`

        case 'bang':
            return `${bangUtils.bang}()`

        case 'symbol':
            return `${msg.strings}([${tokenConversion.toString_}(${msgVariableName}, ${index})])`

        case 'list':
        case 'anything':
            return `${msgVariableName}`

        default:
            throw new Error(`type argument ${typeArgument} not supported (yet)`)
    }
}

const NAMESPACE = 'tokenConversion'

export const messageTokenToFloat: GlobalDefinitions = {
    namespace: NAMESPACE,
    // prettier-ignore
    code: ({ ns: tokenConversion }, { msg }) => Func(tokenConversion.toFloat, [
        Var(msg.Message, `m`), 
        Var(`Int`, `i`)
    ], 'Float')`
        if (${msg.isFloatToken}(m, i)) {
            return ${msg.readFloatToken}(m, i)
        } else {
            return 0
        }
    `
}

export const messageTokenToString: GlobalDefinitions = {
    namespace: NAMESPACE,
    // prettier-ignore
    code: ({ ns: tokenConversion }, { msg }) => Func(tokenConversion.toString_, [
        Var(msg.Message, `m`), 
        Var(`Int`, `i`)
    ], 'string')`
        if (${msg.isStringToken}(m, i)) {
            ${ConstVar(`string`, `str`, `${msg.readStringToken}(m, i)`)}
            if (str === 'bang') {
                return 'symbol'
            } else {
                return str
            }
        } else {
            return 'float'
        }
    `
}