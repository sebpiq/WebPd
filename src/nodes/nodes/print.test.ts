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

import { testHelpers } from '@webpd/compiler'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './print'

describe('print', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have optional first arg', () => {
                testNodeTranslateArgs(builder, ['bla', 123, 'hello'], {
                    prefix: 'bla 123 hello:',
                })
                testNodeTranslateArgs(builder, [], { prefix: 'print:' })
                testNodeTranslateArgs(builder, ['-n'], { prefix: '' })
                testNodeTranslateArgs(builder, ['bla'], { prefix: 'bla:' })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should log message to console %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'print', {
                            prefix: 'this is a test: ',
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [[123, 'blabla'], ['bang'], [0]] } }, { outs: {} }]
                )
            }
        )
    })
})
