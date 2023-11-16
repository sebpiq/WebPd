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

export const bangUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => Sequence([
        Func('msg_isBang', [Var('Message', 'message')], 'boolean')`
            return (
                msg_isStringToken(message, 0) 
                && msg_readStringToken(message, 0) === 'bang'
            )
        `,

        Func('msg_bang', [], 'Message')`
            ${ConstVar('Message', 'message', 'msg_create([MSG_STRING_TOKEN, 4])')}
            msg_writeStringToken(message, 0, 'bang')
            return message
        `,

        Func('msg_emptyToBang', [Var('Message', 'message')], 'Message')`
            if (msg_getLength(message) === 0) {
                return msg_bang()
            } else {
                return message
            }
        `,
    ]),
    dependencies: [stdlib.msg],
}

export const msgUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => Sequence([
        Func('msg_copyTemplate', 
            [Var('Message', 'src'), Var('Int', 'start'), Var('Int', 'end')],
            'MessageTemplate'
        )`
            ${ConstVar('MessageTemplate', 'template', '[]')}
            for (${Var('Int', 'i', 'start')}; i < end; i++) {
                ${ConstVar('Int', 'tokenType', 'msg_getTokenType(src, i)')}
                template.push(tokenType)
                if (tokenType === MSG_STRING_TOKEN) {
                    template.push(msg_readStringToken(src, i).length)
                }
            }
            return template
        `,
    
        Func('msg_copyMessage', 
            [
                Var('Message', 'src'),
                Var('Message', 'dest'),
                Var('Int', 'srcStart'),
                Var('Int', 'srcEnd'),
                Var('Int', 'destStart'),
            ],
            'void'
        )`
            ${Var('Int', 'i', 'srcStart')}
            ${Var('Int', 'j', 'destStart')}
            for (i, j; i < srcEnd; i++, j++) {
                if (msg_getTokenType(src, i) === MSG_STRING_TOKEN) {
                    msg_writeStringToken(dest, j, msg_readStringToken(src, i))
                } else {
                    msg_writeFloatToken(dest, j, msg_readFloatToken(src, i))
                }
            }
        `,
    
        Func('msg_slice', 
            [Var('Message', 'message'), Var('Int', 'start'), Var('Int', 'end')],
            'Message'
        )`
            if (msg_getLength(message) <= start) {
                throw new Error('message empty')
            }
            ${ConstVar(
                'MessageTemplate',
                'template',
                'msg_copyTemplate(message, start, end)'
            )}
            ${ConstVar('Message', 'newMessage', 'msg_create(template)')}
            msg_copyMessage(message, newMessage, start, end, 0)
            return newMessage
        `,
    
        Func('msg_concat', 
            [Var('Message', 'message1'), Var('Message', 'message2')],
            'Message'
        )`
            ${ConstVar('Message', 'newMessage', 'msg_create(msg_copyTemplate(message1, 0, msg_getLength(message1)).concat(msg_copyTemplate(message2, 0, msg_getLength(message2))))')}
            msg_copyMessage(message1, newMessage, 0, msg_getLength(message1), 0)
            msg_copyMessage(message2, newMessage, 0, msg_getLength(message2), msg_getLength(message1))
            return newMessage
        `,
    
        Func('msg_shift', [Var('Message', 'message')], 'Message')`
            switch (msg_getLength(message)) {
                case 0:
                    throw new Error('message empty')
                case 1:
                    return msg_create([])
                default:
                    return msg_slice(message, 1, msg_getLength(message))
            }
        `
    ]),

    dependencies: [stdlib.msg],
}

export const stringMsgUtils: GlobalCodeGeneratorWithSettings = {
    codeGenerator: () => Sequence([
        Func('msg_isAction', 
            [Var('Message', 'message'), Var('string', 'action')],
            'boolean'
        )`
            return msg_isMatching(message, [MSG_STRING_TOKEN])
                && msg_readStringToken(message, 0) === action
        `
    ]),
    dependencies: [stdlib.msg],
}
