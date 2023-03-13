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

import { getMacros } from '@webpd/compiler/src/compile'
import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
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
