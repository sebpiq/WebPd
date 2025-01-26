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

import * as testHelpers from '@webpd/compiler/src/test-helpers'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './symbol'

describe('symbol', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have default value 0', () => {
                testNodeTranslateArgs(builder, ['bla'], { value: 'bla' })
                testNodeTranslateArgs(builder, [], { value: '' })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should output stored value on bang %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'symbol', {
                            value: 'bla',
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['bla']] } },
                    ],
                    [{ ins: { '1': [['blo']] } }, { outs: { '0': [] } }],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['blo']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should store and output value on symbol %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'symbol', {
                            value: 'bla',
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [['blo']] } },
                        { outs: { '0': [['blo']] } },
                    ],
                    [
                        { ins: { '0': [['bang']] } },
                        { outs: { '0': [['blo']] } },
                    ]
                )
            }
        )
    })
})
