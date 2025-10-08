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
import { GlobalDefinitions } from '@webpd/compiler'

export const bangUtils: GlobalDefinitions = {
    namespace: 'bangUtils',
    // prettier-ignore
    code: ({ ns: bangUtils }, { msg }) => Sequence([
        Func(bangUtils.isBang, [
            Var(msg.Message, `message`)
        ], 'boolean')`
            return (
                ${msg.isStringToken}(message, 0) 
                && ${msg.readStringToken}(message, 0) === 'bang'
            )
        `,

        Func(bangUtils.bang, [], msg.Message)`
            ${ConstVar(msg.Message, `message`, `${msg.create}([${msg.STRING_TOKEN}, 4])`)}
            ${msg.writeStringToken}(message, 0, 'bang')
            return message
        `,

        Func(bangUtils.emptyToBang, [
            Var(msg.Message, `message`)
        ], msg.Message)`
            if (${msg.getLength}(message) === 0) {
                return ${bangUtils.bang}()
            } else {
                return message
            }
        `,
    ]),
    dependencies: [stdlib.msg],
}

export const msgUtils: GlobalDefinitions = {
    namespace: 'msgUtils',
    // prettier-ignore
    code: ({ ns: msgUtils }, { msg }) => Sequence([
        Func(msgUtils.slice, [
            Var(msg.Message, `message`), 
            Var(`Int`, `start`), 
            Var(`Int`, `end`)
        ], msg.Message)`
            if (${msg.getLength}(message) <= start) {
                throw new Error('message empty')
            }
            ${ConstVar(
                msg.Template,
                'template',
                `${msgUtils._copyTemplate}(message, start, end)`
            )}
            ${ConstVar(msg.Message, `newMessage`, `${msg.create}(template)`)}
            ${msgUtils.copy}(message, newMessage, start, end, 0)
            return newMessage
        `,
    
        Func(msgUtils.concat, [
            Var(msg.Message, `message1`), 
            Var(msg.Message, `message2`)
        ], msg.Message)`
            ${ConstVar(
                msg.Message, 
                'newMessage', 
                `${msg.create}(${msgUtils._copyTemplate}(message1, 0, ${msg.getLength}(message1)).concat(${msgUtils._copyTemplate}(message2, 0, ${msg.getLength}(message2))))`)
            }
            ${msgUtils.copy}(message1, newMessage, 0, ${msg.getLength}(message1), 0)
            ${msgUtils.copy}(message2, newMessage, 0, ${msg.getLength}(message2), ${msg.getLength}(message1))
            return newMessage
        `,
    
        Func(msgUtils.shift, [
            Var(msg.Message, `message`)
        ], msg.Message)`
            switch (${msg.getLength}(message)) {
                case 0:
                    throw new Error('message empty')
                case 1:
                    return ${msg.create}([])
                default:
                    return ${msgUtils.slice}(message, 1, ${msg.getLength}(message))
            }
        `,

        Func(msgUtils.copy, [
            Var(msg.Message, `src`),
            Var(msg.Message, `dest`),
            Var(`Int`, `srcStart`),
            Var(`Int`, `srcEnd`),
            Var(`Int`, `destStart`),
        ], 'void')`
            ${Var(`Int`, `i`, `srcStart`)}
            ${Var(`Int`, `j`, `destStart`)}
            for (i, j; i < srcEnd; i++, j++) {
                if (${msg.getTokenType}(src, i) === ${msg.STRING_TOKEN}) {
                    ${msg.writeStringToken}(dest, j, ${msg.readStringToken}(src, i))
                } else {
                    ${msg.writeFloatToken}(dest, j, ${msg.readFloatToken}(src, i))
                }
            }
        `,

        Func(msgUtils._copyTemplate, [
            Var(msg.Message, `src`), 
            Var(`Int`, `start`), 
            Var(`Int`, `end`)
        ], msg.Template)`
            ${ConstVar(msg.Template, `template`, `[]`)}
            for (${Var(`Int`, `i`, `start`)}; i < end; i++) {
                ${ConstVar(`Int`, `tokenType`, `${msg.getTokenType}(src, i)`)}
                template.push(tokenType)
                if (tokenType === ${msg.STRING_TOKEN}) {
                    template.push(${msg.readStringToken}(src, i).length)
                }
            }
            return template
        `,
    ]),

    dependencies: [stdlib.msg],
}

export const actionUtils: GlobalDefinitions = {
    namespace: 'actionUtils',
    // prettier-ignore
    code: ({ ns: actionUtils }, { msg }) => Sequence([
        Func(actionUtils.isAction, [
            Var(msg.Message, `message`), 
            Var(`string`, `action`)
        ], 'boolean')`
            return ${msg.isMatching}(message, [${msg.STRING_TOKEN}])
                && ${msg.readStringToken}(message, 0) === action
        `
    ]),
    dependencies: [stdlib.msg],
}
