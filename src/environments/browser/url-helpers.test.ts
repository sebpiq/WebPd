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

import assert from "assert"
import { isExternalUrl, urlDirName } from "./url-helpers"

describe('url-helpers', () => {

    afterEach(() => {
        ;(global as any).document = undefined
    })

    describe('isExternalUrl', () => {
        it('should return true for external urls', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }          
            assert.strictEqual(isExternalUrl('https://example.com'), true)
            assert.strictEqual(isExternalUrl('https://example.com/bla'), true)
        })

        it('should return false for relative urls', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }          
            assert.strictEqual(isExternalUrl('bla'), false)
            assert.strictEqual(isExternalUrl('bla/bla'), false)
            assert.strictEqual(isExternalUrl(''), false)
            assert.strictEqual(isExternalUrl('.'), false)
        })

        it('should return false for absolute urls', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }
            assert.strictEqual(isExternalUrl('/bla'), false)
            assert.strictEqual(isExternalUrl('/bla/bla'), false)
            assert.strictEqual(isExternalUrl('/'), false)
        })
    })

    describe('urlDirName', () => {
        it('should return the parent of an external url', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }          
            assert.strictEqual(urlDirName('https://example.com'), 'https://example.com/')
            assert.strictEqual(urlDirName('https://example.com/bla.mp3'), 'https://example.com/')
            assert.strictEqual(urlDirName('https://example.com/bla/file.pd'), 'https://example.com/bla/')
        })

        it('should return the parent of a relative url', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }          
            assert.strictEqual(urlDirName('bla'), 'https://overflow.com/questions/41098009/')
            assert.strictEqual(urlDirName('bla.mp3'), 'https://overflow.com/questions/41098009/')
            assert.strictEqual(urlDirName('bla/file.pd'), 'https://overflow.com/questions/41098009/bla/')
        })

        it('should return the parent of an absolute url', () => {
            ;(global as any).document = {
                URL: 'https://overflow.com/questions/41098009/mocking-document-in-jest',
                baseURI: 'https://overflow.com/questions/41098009/mocking-document-in-jest'
            }          
            assert.strictEqual(urlDirName('/bla'), 'https://overflow.com/')
            assert.strictEqual(urlDirName('/bla.mp3'), 'https://overflow.com/')
            assert.strictEqual(urlDirName('/bla/file.pd'), 'https://overflow.com/bla/')
            assert.strictEqual(urlDirName('/bla/blo/file.pd'), 'https://overflow.com/bla/blo/')
        })
    })

})