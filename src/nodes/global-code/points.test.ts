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
import { interpolateLin } from './points'
import { runTestSuite } from '@webpd/compiler/src/test-helpers'
import { stdlib, AnonFunc } from '@webpd/compiler'

describe('global-code.points', () => {
    runTestSuite([
        {
            description: 'interpolateLin > should compute linear interpolation %s',
            testFunction: ({ globals: { points } }) => AnonFunc()`
                assert_floatsEqual(${points.interpolateLin}(                
                    0,
                    {x: 0, y: 0},
                    {x: 1, y: 1},
                ), 0)

                assert_floatsEqual(${points.interpolateLin}(                
                    0.5,
                    {x: 0, y: 0},
                    {x: 1, y: 1},
                ), 0.5)

                assert_floatsEqual(${points.interpolateLin}(                
                    15.5,
                    {x: -1.5, y: -2},
                    {x: 0.5, y: 2},
                ), 32)
            `
        },
    ], [stdlib.core, interpolateLin])
})
