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

import assert from 'assert'
import {
    assertNumber,
    assertOptionalNumber,
    assertOptionalString,
    assertString,
} from './validation'

describe('validation', () => {
    describe('assertNumber', () => {
        it('should return a number if input is a number', () => {
            assert.strictEqual(assertNumber(12), 12)
        })

        it('should throw if input is not a number', () => {
            assert.throws(() => assertNumber('12'))
            assert.throws(() => assertNumber(undefined))
        })
    })

    describe('assertString', () => {
        it('should return a string if input is a string', () => {
            assert.strictEqual(assertString('coucou'), 'coucou')
        })

        it('should throw if input is not a string', () => {
            assert.throws(() => assertString(12))
            assert.throws(() => assertString(undefined))
        })
    })

    describe('assertOptionalNumber', () => {
        it('should return a number if input is a number', () => {
            assert.strictEqual(assertOptionalNumber(12), 12)
        })

        it('should throw if input is not a number nor undefined', () => {
            assert.throws(() => assertOptionalNumber('12'))
        })

        it('should return undefined if input is undefined', () => {
            assert.strictEqual(assertOptionalNumber(undefined), undefined)
        })
    })

    describe('assertOptionalString', () => {
        it('should return a string if input is a string', () => {
            assert.strictEqual(assertOptionalString('coucou'), 'coucou')
        })

        it('should throw if input is not a string nor undefined', () => {
            assert.throws(() => assertOptionalString(12))
        })

        it('should return undefined if input is undefined', () => {
            assert.strictEqual(assertOptionalString(undefined), undefined)
        })
    })
})
