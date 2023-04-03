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

import * as nodeImplementationsTestHelpers from '@webpd/compiler/src/test-helpers-node-implementations'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'
import { nodeImplementation, builder } from './unpack'

describe('unpack', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    typeArguments: ['float', 'float']
                })
                testNodeTranslateArgs(builder, ['f', 12, 'float', 'symbol'], {
                    typeArguments: ['float', 'float', 'float', 'symbol']
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should unpack values %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'unpack', {
                            typeArguments: ['float', 'symbol']
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [
                            [123, 'hello'],
                            [888, 'poi'],
                        ] } },
                        { outs: { '0': [[123], [888]], '1': [['hello'], ['poi']] } },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should unpack values even if message shorter than object args %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'unpack', {
                            typeArguments: ['float', 'symbol', 'float']
                        }),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [
                            [666, 'hello'],
                            [888],
                        ] } },
                        { outs: { '0': [[666], [888]], '1': [['hello']], '2': [] } },
                    ]
                )
            }
        )
    })
})
