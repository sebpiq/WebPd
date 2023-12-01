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
import { nodeImplementations, builders } from './float-int'

describe('float / int', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have default value 0', () => {
                testNodeTranslateArgs(builders['float'], [1], { value: 1 })
                testNodeTranslateArgs(builders['float'], [], { value: 0 })
            })
        })
    })

    describe('implementation', () => {
        describe('float', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should output stored value on bang %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['float'], 'float', {
                                value: 2.9,
                            }),
                            nodeImplementation: nodeImplementations['float'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[2.9]] } },
                        ],
                        [{ ins: { '1': [[666]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[666]] } },
                        ]
                    )
                }
            )

            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should store and output value on float %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['float'], 'float', {
                                value: -11,
                            }),
                            nodeImplementation: nodeImplementations['float'],
                        },
                        [
                            { ins: { '0': [[-9.99]] } },
                            { outs: { '0': [[-9.99]] } },
                        ],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[-9.99]] } },
                        ]
                    )
                }
            )
        })

        describe('int', () => {
            it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
                'should round stored value correctly %s',
                async ({ target, bitDepth }) => {
                    await nodeImplementationsTestHelpers.assertNodeOutput(
                        {
                            target,
                            bitDepth,
                            node: buildNode(builders['int'], 'int', {
                                value: 2.9,
                            }),
                            nodeImplementation: nodeImplementations['int'],
                        },
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[2]] } },
                        ],
                        [{ ins: { '1': [[-6.9]] } }, { outs: { '0': [] } }],
                        [
                            { ins: { '0': [['bang']] } },
                            { outs: { '0': [[-6]] } },
                        ]
                    )
                }
            )
        })
    })
})
