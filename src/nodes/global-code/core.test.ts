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

import { runTestSuite } from '@webpd/compiler/src/test-helpers'
import { bangUtils, msgUtils } from './core'
import { stdlib } from '@webpd/compiler'
import { AnonFunc, ConstVar } from '@webpd/compiler'

describe('global-code.core', () => {
    runTestSuite([
        {
            description: 'bangUtils > msg_isBang > should match given message %s',
            testFunction: () => AnonFunc()`
                ${ConstVar('Message', 'message1', 'msg_create([MSG_STRING_TOKEN, 4])')}
                msg_writeStringToken(message1, 0, 'bang')
                assert_booleansEqual(msg_isBang(message1), true)

                ${ConstVar('Message', 'message2', 'msg_create([MSG_STRING_TOKEN, 4, MSG_FLOAT_TOKEN])')}
                msg_writeStringToken(message2, 0, 'bang')
                msg_writeFloatToken(message2, 1, 123)
                assert_booleansEqual(msg_isBang(message2), true)

                ${ConstVar('Message', 'message3', 'msg_create([MSG_FLOAT_TOKEN])')}
                msg_writeFloatToken(message3, 0, 123)
                assert_booleansEqual(msg_isBang(message3), false)

                ${ConstVar('Message', 'message4', 'msg_create([MSG_STRING_TOKEN, 4])')}
                msg_writeStringToken(message4, 0, 'BNAG')
                assert_booleansEqual(msg_isBang(message4), false)
            `
        },

        {
            description: 'bangUtils > msg_bang > should create bang message %s',
            testFunction: () => AnonFunc()`
                ${ConstVar('Message', 'message', 'msg_bang()')}
                assert_booleansEqual(msg_isMatching(message, [MSG_STRING_TOKEN]), true)
                assert_stringsEqual(msg_readStringToken(message, 0), 'bang')
            `
        },

        {
            description: 'msgUtils > msg_slice > should slice the message as expected %s',
            testFunction: () => AnonFunc()`
                ${ConstVar('Message', 'message', 'msg_create([MSG_STRING_TOKEN, 3, MSG_STRING_TOKEN, 3, MSG_FLOAT_TOKEN])')}
                msg_writeStringToken(message, 0, 'bla')
                msg_writeStringToken(message, 1, 'blo')
                msg_writeFloatToken(message, 2, 1)

                ${ConstVar('Message', 'sliced1', 'msg_slice(message, 0, 3)')}
                assert_booleansEqual(msg_isMatching(sliced1, [MSG_STRING_TOKEN, MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]), true)
                assert_stringsEqual(msg_readStringToken(sliced1, 0), 'bla')
                assert_stringsEqual(msg_readStringToken(sliced1, 1), 'blo')
                assert_floatsEqual(msg_readFloatToken(sliced1, 2), 1)

                ${ConstVar('Message', 'sliced2', 'msg_slice(message, 0, 2)')}
                assert_booleansEqual(msg_isMatching(sliced2, [MSG_STRING_TOKEN, MSG_STRING_TOKEN]), true)
                assert_stringsEqual(msg_readStringToken(sliced2, 0), 'bla')
                assert_stringsEqual(msg_readStringToken(sliced2, 1), 'blo')

                ${ConstVar('Message', 'sliced3', 'msg_slice(message, 0, 0)')}
                assert_booleansEqual(msg_isMatching(sliced3, []), true)

                ${ConstVar('Message', 'sliced4', 'msg_slice(msg_floats([1, 2, 3]), 1, 2)')}
                assert_booleansEqual(msg_isMatching(sliced4, [MSG_FLOAT_TOKEN]), true)
                assert_floatsEqual(msg_readFloatToken(sliced4, 0), 2)
            `
        },

        {
            description: 'msgUtils > msg_concat > should concatenate 2 messages %s',
            testFunction: () => AnonFunc()`
                ${ConstVar('Message', 'message1', 'msg_create([MSG_STRING_TOKEN, 3, MSG_STRING_TOKEN, 3, MSG_FLOAT_TOKEN])')}
                msg_writeStringToken(message1, 0, 'bla')
                msg_writeStringToken(message1, 1, 'blo')
                msg_writeFloatToken(message1, 2, 1)

                ${ConstVar('Message', 'message2', 'msg_create([MSG_FLOAT_TOKEN])')}
                msg_writeFloatToken(message2, 0, 666)

                ${ConstVar('Message', 'concated1', 'msg_concat(message1, message2)')}
                assert_booleansEqual(msg_isMatching(concated1, [
                    MSG_STRING_TOKEN, MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN]), true)
                assert_stringsEqual(msg_readStringToken(concated1, 0), 'bla')
                assert_stringsEqual(msg_readStringToken(concated1, 1), 'blo')
                assert_floatsEqual(msg_readFloatToken(concated1, 2), 1)
                assert_floatsEqual(msg_readFloatToken(concated1, 3), 666)

                ${ConstVar('Message', 'concated2', 'msg_concat(msg_floats([111, 222]), msg_create([]))')}
                assert_booleansEqual(msg_isMatching(concated2, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN]), true)
                assert_floatsEqual(msg_readFloatToken(concated2, 0), 111)
                assert_floatsEqual(msg_readFloatToken(concated2, 1), 222)

                ${ConstVar('Message', 'concated3', 'msg_concat(msg_create([]), msg_floats([333, 444]))')}
                assert_booleansEqual(msg_isMatching(concated3, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN]), true)
                assert_floatsEqual(msg_readFloatToken(concated3, 0), 333)
                assert_floatsEqual(msg_readFloatToken(concated3, 1), 444)
            `
        },

        {
            description: 'msgUtils > msg_shift > should remove first element from message %s',
            testFunction: () => AnonFunc()`
                ${ConstVar('Message', 'message', 'msg_create([MSG_STRING_TOKEN, 3, MSG_STRING_TOKEN, 3, MSG_FLOAT_TOKEN])')}
                msg_writeStringToken(message, 0, 'bla')
                msg_writeStringToken(message, 1, 'blo')
                msg_writeFloatToken(message, 2, 1)

                ${ConstVar('Message', 'shifted1', 'msg_shift(message)')}
                assert_booleansEqual(msg_isMatching(shifted1, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]), true)
                assert_stringsEqual(msg_readStringToken(shifted1, 0), 'blo')
                assert_floatsEqual(msg_readFloatToken(shifted1, 1), 1)

                ${ConstVar('Message', 'shifted2', 'msg_shift(msg_strings(["bla"]))')}
                assert_booleansEqual(msg_isMatching(shifted2, []), true)

            `
        },
    ], [stdlib.core, stdlib.msg, bangUtils, msgUtils])
})