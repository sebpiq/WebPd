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

import { testHelpers, stdlib, AnonFunc, ConstVar } from '@webpd/compiler'
import { bangUtils, msgUtils } from './core'
import { initializeTests } from '../test-helpers'
initializeTests()

describe('global-code.core', () => {
    testHelpers.runTestSuite([
        {
            description: 'bangUtils > isBang > should match given message %s',
            testFunction: ({ globals: { bangUtils, msg } }) => AnonFunc()`
                ${ConstVar(msg.Message, `message1`, `${msg.create}([${msg.STRING_TOKEN}, 4])`)}
                ${msg.writeStringToken}(message1, 0, 'bang')
                assert_booleansEqual(${bangUtils.isBang}(message1), true)

                ${ConstVar(msg.Message, `message2`, `${msg.create}([${msg.STRING_TOKEN}, 4, ${msg.FLOAT_TOKEN}])`)}
                ${msg.writeStringToken}(message2, 0, 'bang')
                ${msg.writeFloatToken}(message2, 1, 123)
                assert_booleansEqual(${bangUtils.isBang}(message2), true)

                ${ConstVar(msg.Message, `message3`, `${msg.create}([${msg.FLOAT_TOKEN}])`)}
                ${msg.writeFloatToken}(message3, 0, 123)
                assert_booleansEqual(${bangUtils.isBang}(message3), false)

                ${ConstVar(msg.Message, `message4`, `${msg.create}([${msg.STRING_TOKEN}, 4])`)}
                ${msg.writeStringToken}(message4, 0, 'BNAG')
                assert_booleansEqual(${bangUtils.isBang}(message4), false)
            `
        },

        {
            description: 'bangUtils > bang > should create bang message %s',
            testFunction: ({ globals: { bangUtils, msg } }) => AnonFunc()`
                ${ConstVar(msg.Message, `message`, `${bangUtils.bang}()`)}
                assert_booleansEqual(${msg.isMatching}(message, [${msg.STRING_TOKEN}]), true)
                assert_stringsEqual(${msg.readStringToken}(message, 0), 'bang')
            `
        },

        {
            description: 'msgUtils > slice > should slice the message as expected %s',
            testFunction: ({ globals: { msgUtils, msg } }) => AnonFunc()`
                ${ConstVar(msg.Message, `message`, `${msg.create}([${msg.STRING_TOKEN}, 3, ${msg.STRING_TOKEN}, 3, ${msg.FLOAT_TOKEN}])`)}
                ${msg.writeStringToken}(message, 0, 'bla')
                ${msg.writeStringToken}(message, 1, 'blo')
                ${msg.writeFloatToken}(message, 2, 1)

                ${ConstVar(msg.Message, `sliced1`, `${msgUtils.slice}(message, 0, 3)`)}
                assert_booleansEqual(${msg.isMatching}(sliced1, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}]), true)
                assert_stringsEqual(${msg.readStringToken}(sliced1, 0), 'bla')
                assert_stringsEqual(${msg.readStringToken}(sliced1, 1), 'blo')
                assert_floatsEqual(${msg.readFloatToken}(sliced1, 2), 1)

                ${ConstVar(msg.Message, `sliced2`, `${msgUtils.slice}(message, 0, 2)`)}
                assert_booleansEqual(${msg.isMatching}(sliced2, [${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}]), true)
                assert_stringsEqual(${msg.readStringToken}(sliced2, 0), 'bla')
                assert_stringsEqual(${msg.readStringToken}(sliced2, 1), 'blo')

                ${ConstVar(msg.Message, `sliced3`, `${msgUtils.slice}(message, 0, 0)`)}
                assert_booleansEqual(${msg.isMatching}(sliced3, []), true)

                ${ConstVar(msg.Message, `sliced4`, `${msgUtils.slice}(${msg.floats}([1, 2, 3]), 1, 2)`)}
                assert_booleansEqual(${msg.isMatching}(sliced4, [${msg.FLOAT_TOKEN}]), true)
                assert_floatsEqual(${msg.readFloatToken}(sliced4, 0), 2)
            `
        },

        {
            description: 'msgUtils > concat > should concatenate 2 messages %s',
            testFunction: ({ globals: { msgUtils, msg } }) => AnonFunc()`
                ${ConstVar(msg.Message, `message1`, `${msg.create}([${msg.STRING_TOKEN}, 3, ${msg.STRING_TOKEN}, 3, ${msg.FLOAT_TOKEN}])`)}
                ${msg.writeStringToken}(message1, 0, 'bla')
                ${msg.writeStringToken}(message1, 1, 'blo')
                ${msg.writeFloatToken}(message1, 2, 1)

                ${ConstVar(msg.Message, `message2`, `${msg.create}([${msg.FLOAT_TOKEN}])`)}
                ${msg.writeFloatToken}(message2, 0, 666)

                ${ConstVar(msg.Message, `concated1`, `${msgUtils.concat}(message1, message2)`)}
                assert_booleansEqual(${msg.isMatching}(concated1, [
                    ${msg.STRING_TOKEN}, ${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}]), true)
                assert_stringsEqual(${msg.readStringToken}(concated1, 0), 'bla')
                assert_stringsEqual(${msg.readStringToken}(concated1, 1), 'blo')
                assert_floatsEqual(${msg.readFloatToken}(concated1, 2), 1)
                assert_floatsEqual(${msg.readFloatToken}(concated1, 3), 666)

                ${ConstVar(msg.Message, `concated2`, `${msgUtils.concat}(${msg.floats}([111, 222]), ${msg.create}([]))`)}
                assert_booleansEqual(${msg.isMatching}(concated2, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}]), true)
                assert_floatsEqual(${msg.readFloatToken}(concated2, 0), 111)
                assert_floatsEqual(${msg.readFloatToken}(concated2, 1), 222)

                ${ConstVar(msg.Message, `concated3`, `${msgUtils.concat}(${msg.create}([]), ${msg.floats}([333, 444]))`)}
                assert_booleansEqual(${msg.isMatching}(concated3, [${msg.FLOAT_TOKEN}, ${msg.FLOAT_TOKEN}]), true)
                assert_floatsEqual(${msg.readFloatToken}(concated3, 0), 333)
                assert_floatsEqual(${msg.readFloatToken}(concated3, 1), 444)
            `
        },

        {
            description: 'msgUtils > shift > should remove first element from message %s',
            testFunction: ({ globals: { msgUtils, msg } }) => AnonFunc()`
                ${ConstVar(msg.Message, `message`, `${msg.create}([${msg.STRING_TOKEN}, 3, ${msg.STRING_TOKEN}, 3, ${msg.FLOAT_TOKEN}])`)}
                ${msg.writeStringToken}(message, 0, 'bla')
                ${msg.writeStringToken}(message, 1, 'blo')
                ${msg.writeFloatToken}(message, 2, 1)

                ${ConstVar(msg.Message, `shifted1`, `${msgUtils.shift}(message)`)}
                assert_booleansEqual(${msg.isMatching}(shifted1, [${msg.STRING_TOKEN}, ${msg.FLOAT_TOKEN}]), true)
                assert_stringsEqual(${msg.readStringToken}(shifted1, 0), 'blo')
                assert_floatsEqual(${msg.readFloatToken}(shifted1, 1), 1)

                ${ConstVar(msg.Message, `shifted2`, `${msgUtils.shift}(${msg.strings}(["bla"]))`)}
                assert_booleansEqual(${msg.isMatching}(shifted2, []), true)

            `
        },
    ], [stdlib.core, stdlib.msg, bangUtils, msgUtils])
})