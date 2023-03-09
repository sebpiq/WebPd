import {
    CodeVariableName, SharedCodeGenerator,
} from '@webpd/compiler-js/src/types'
import { ValidationError } from './validation'

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
    msgVariableName: CodeVariableName,
    index: number
) => {
    switch (typeArgument) {
        case 'float':
            return `msg_floats([messageTokenToFloat(${msgVariableName}, ${index})])`

        case 'bang':
            return `msg_bang()`

        case 'symbol':
            return `msg_strings([messageTokenToString(${msgVariableName}, ${index})])`

        case 'list':
        case 'anything':
            return `${msgVariableName}`

        default:
            throw new Error(`type argument ${typeArgument} not supported (yet)`)
    }
}

export const messageTokenToFloat: SharedCodeGenerator = ({ macros: { Func, Var }}) => `
    function messageTokenToFloat ${Func([
        Var('m', 'Message'), 
        Var('i', 'Int')
    ], 'Float')} {
        if (msg_isFloatToken(m, i)) {
            return msg_readFloatToken(m, i)
        } else {
            return 0
        }
    }
`

export const messageTokenToString: SharedCodeGenerator = ({ macros: { Func, Var }}) => `
    function messageTokenToString ${Func([
        Var('m', 'Message'), 
        Var('i', 'Int')
    ], 'string')} {
        if (msg_isStringToken(m, i)) {
            const ${Var('str', 'string')} = msg_readStringToken(m, i)
            if (str === 'bang') {
                return 'symbol'
            } else {
                return str
            }
        } else {
            return 'float'
        }
    }
`
