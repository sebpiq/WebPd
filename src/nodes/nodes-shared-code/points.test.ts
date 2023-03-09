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

import { getMacros } from '@webpd/compiler-js/src/compile'
import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import assert from 'assert'
import { interpolateLin } from './points'
import { NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'

describe('nodes-shared-code.points', () => {
    describe('interpolateLin', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should compute linear interpolation %s',
            async ({ bitDepth, target }) => {
                const macros = getMacros(target)
                const { Var, Func } = macros
                const code =
                    interpolateLin.map((codeGen) => codeGen({ macros })).join('\n') +
                    `
                    function testCreatePoint ${Func([
                        Var('x', 'Float'), 
                        Var('y', 'Float')
                    ], 'Point')} {
                        return { x, y }
                    }
                `

                const bindings =
                    await nodeImplementationsTestHelpers.createTestBindings(
                        code,
                        target,
                        bitDepth,
                        {
                            interpolateLin: 0,
                            testCreatePoint: 0,
                        }
                    )

                assert.strictEqual(
                    bindings.interpolateLin(
                        0,
                        bindings.testCreatePoint(0, 0),
                        bindings.testCreatePoint(1, 1)
                    ),
                    0
                )

                assert.strictEqual(
                    bindings.interpolateLin(
                        0.5,
                        bindings.testCreatePoint(0, 0),
                        bindings.testCreatePoint(1, 1)
                    ),
                    0.5
                )

                assert.strictEqual(
                    bindings.interpolateLin(
                        15.5,
                        bindings.testCreatePoint(-1.5, -2),
                        bindings.testCreatePoint(0.5, 2)
                    ),
                    32
                )
            }
        )
    })
})
