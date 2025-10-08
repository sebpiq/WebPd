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
import { stdlib, AnonFunc, testHelpers } from "@webpd/compiler"
import { computeUnitInSamples } from './timing'
import { initializeTests } from '../test-helpers'
initializeTests()

describe('global-code.timing', () => {
    testHelpers.runTestSuite([
        {
            description: 'computeUnitInSamples > should convert milliseconds to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    10,
                    'msec',
                ), 40)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    5,
                    'milliseconds',
                ), 20)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    20,
                    'millisecond',
                ), 80)
            `
        },
        {
            description: 'computeUnitInSamples > should convert per milliseconds to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    4,
                    'permsec',
                ), 2.5)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    8,
                    'permilliseconds',
                ), 1.25)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    2,
                    'permillisecond',
                ), 5)
            `
        },
        {
            description: 'computeUnitInSamples > should convert seconds to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    10,
                    'sec',
                ), 40000)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    5,
                    'seconds',
                ), 20000)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    20,
                    'second',
                ), 80000)
            `
        },
        {
            description: 'computeUnitInSamples > should convert per seconds to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    4,
                    'persec',
                ), 2500)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    8,
                    'perseconds',
                ), 1250)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    2,
                    'persecond',
                ), 5000)
            `
        },
        {
            description: 'computeUnitInSamples > should convert minutes to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    10,
                    'min',
                ), 40 * 60 * 10)

                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    5,
                    'minutes',
                ), 40 * 60 * 5)

                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    20,
                    'minute',
                ), 40 * 60 * 20)
            `
        },
        {
            description: 'computeUnitInSamples > should convert per minutes to samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    6,
                    'permin',
                ), 10 * 4000)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    3,
                    'perminutes',
                ), 20 * 4000)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    2,
                    'perminute',
                ), 30 * 4000)
            `
        },
        {
            description: 'computeUnitInSamples > should output samples %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    10,
                    'samp',
                ), 10)

                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    5,
                    'samples',
                ), 5)

                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    20,
                    'sample',
                ), 20)
            `
        },
        {
            description: 'computeUnitInSamples > should return 0 if amount = 0 %s',
            testFunction: () => AnonFunc()`
                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persamp',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persamples',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persample',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'msec',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'milliseconds',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'millisecond',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'permsec',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'permilliseconds',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'permillisecond',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'sec',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'seconds',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'second',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'persec',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'perseconds',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    10000,
                    0,
                    'persecond',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    0,
                    'min',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    0,
                    'minutes',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    40,
                    0,
                    'minute',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'permin',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'perminutes',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0,
                    'perminute',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    0,
                    'samp',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    0,
                    'samples',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    666,
                    0,
                    'sample',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persamp',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persamples',
                ), 0)

                assert_floatsEqual(computeUnitInSamples(                
                    4000,
                    0.0,
                    'persample',
                ), 0)
            `
        },
    ], [stdlib.core, computeUnitInSamples])
})
