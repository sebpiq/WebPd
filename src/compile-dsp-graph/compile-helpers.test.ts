/*
 * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
 *
 * BSD Simplified License.
 * For information on usage and redistribution, and for a DISCLAIMER OF ALL
 * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
 *
 * See https://github.com/sebpiq/WebPd_pd-parser for documentation
 *
 */

import { makePd } from '@webpd/pd-parser/src/test-helpers'
import assert from 'assert'
import { resolveDollarArg } from './compile-helpers'

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
