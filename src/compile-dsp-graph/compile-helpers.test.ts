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
import { resolveDollarArg } from './compile-helpers'
import { makePd } from './test-helpers'

describe('pdjson-helpers', () => {
    describe('resolveDollarArg', () => {
        const pd = makePd({
            patches: {
                '111': {
                    nodes: {},
                    connections: [],
                    args: ['hihi', 'haha', 123],
                },
            },
        })

        it('should resolve $0 to patch id', () => {
            assert.deepStrictEqual(
                resolveDollarArg('$0-BLA', pd.patches['111']!),
                '111-BLA'
            )
        })

        it('should resolve other $ to patch args', () => {
            assert.deepStrictEqual(
                resolveDollarArg('BLA-$1$3', pd.patches['111']!),
                'BLA-hihi123'
            )
        })

        it('should not resolve if $ out of range and template string', () => {
            assert.deepStrictEqual(
                resolveDollarArg('BLA-$1-$10', pd.patches['111']!),
                'BLA-hihi-$10'
            )
        })

        it('should resolve to undefined if $ out of range and dollar string', () => {
            assert.deepStrictEqual(
                resolveDollarArg('$10', pd.patches['111']!),
                undefined
            )
        })

        it('should leave string untouched', () => {
            assert.deepStrictEqual(
                resolveDollarArg('BLA BLA', pd.patches['111']!),
                'BLA BLA'
            )
        })

        it('should resolve to float if simple dollar arg and float arg', () => {
            assert.deepStrictEqual(
                resolveDollarArg('$3', pd.patches['111']!),
                123
            )
        })
    })
})
