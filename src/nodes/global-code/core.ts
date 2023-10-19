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

export const bangUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: ({ macros: { Func, Var } }) => `
    function msg_isBang ${Func([Var('message', 'Message')], 'boolean')} {
        return (
            msg_isStringToken(message, 0) 
            && msg_readStringToken(message, 0) === 'bang'
        )
    }

    function msg_bang ${Func([], 'Message')} {
        const ${Var('message', 'Message')} = msg_create([MSG_STRING_TOKEN, 4])
        msg_writeStringToken(message, 0, 'bang')
        return message
    }

    function msg_emptyToBang ${Func([Var('message', 'Message')], 'Message')} {
        if (msg_getLength(message) === 0) {
            return msg_bang()
        } else {
            return message
        }
    }
`,
    dependencies: [coreCode.msg],
}

export const msgUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: ({ macros: { Func, Var } }) => `

    function msg_copyTemplate ${Func(
        [Var('src', 'Message'), Var('start', 'Int'), Var('end', 'Int')],
        'MessageTemplate'
    )} {
        const ${Var('template', 'MessageTemplate')} = []
        for (let ${Var('i', 'Int')} = start; i < end; i++) {
            const ${Var('tokenType', 'Int')} = msg_getTokenType(src, i)
            template.push(tokenType)
            if (tokenType === MSG_STRING_TOKEN) {
                template.push(msg_readStringToken(src, i).length)
            }
        }
        return template
    }

    function msg_copyMessage ${Func(
        [
            Var('src', 'Message'),
            Var('dest', 'Message'),
            Var('srcStart', 'Int'),
            Var('srcEnd', 'Int'),
            Var('destStart', 'Int'),
        ],
        'void'
    )} {
        let ${Var('i', 'Int')} = srcStart
        let ${Var('j', 'Int')} = destStart
        for (i, j; i < srcEnd; i++, j++) {
            if (msg_getTokenType(src, i) === MSG_STRING_TOKEN) {
                msg_writeStringToken(dest, j, msg_readStringToken(src, i))
            } else {
                msg_writeFloatToken(dest, j, msg_readFloatToken(src, i))
            }
        }
    }

    function msg_slice ${Func(
        [Var('message', 'Message'), Var('start', 'Int'), Var('end', 'Int')],
        'Message'
    )} {
        if (msg_getLength(message) <= start) {
            throw new Error('message empty')
        }
        const ${Var(
            'template',
            'MessageTemplate'
        )} = msg_copyTemplate(message, start, end)
        const ${Var('newMessage', 'Message')} = msg_create(template)
        msg_copyMessage(message, newMessage, start, end, 0)
        return newMessage
    }

    function msg_concat  ${Func(
        [Var('message1', 'Message'), Var('message2', 'Message')],
        'Message'
    )} {
        const ${Var('newMessage', 'Message')} = msg_create(
            msg_copyTemplate(message1, 0, msg_getLength(message1))
                .concat(msg_copyTemplate(message2, 0, msg_getLength(message2))))
        msg_copyMessage(message1, newMessage, 0, msg_getLength(message1), 0)
        msg_copyMessage(message2, newMessage, 0, msg_getLength(message2), msg_getLength(message1))
        return newMessage
    }

    function msg_shift ${Func([Var('message', 'Message')], 'Message')} {
        switch (msg_getLength(message)) {
            case 0:
                throw new Error('message empty')
            case 1:
                return msg_create([])
            default:
                return msg_slice(message, 1, msg_getLength(message))
        }
    }
`,
    dependencies: [coreCode.msg],
}

export const stringMsgUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: ({ macros: { Func, Var } }) => `
    function msg_isAction ${Func(
        [Var('message', 'Message'), Var('action', 'string')],
        'boolean'
    )} {
        return msg_isMatching(message, [MSG_STRING_TOKEN])
            && msg_readStringToken(message, 0) === action
    }
`,
    dependencies: [coreCode.msg],
}
