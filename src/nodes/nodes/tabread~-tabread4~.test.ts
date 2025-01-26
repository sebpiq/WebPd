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
import { nodeImplementations, builders } from './tabread~-tabread4~'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
    testNodeTranslateArgs,
} from '../test-helpers'

describe('tabread~ tabread4~', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have empty array name by default', () => {
                testNodeTranslateArgs(builders['tabread~'], [], {
                    arrayName: '',
                })
            })
            it('should have empty array name by default', () => {
                testNodeTranslateArgs(builders['tabread4~'], [], {
                    arrayName: '',
                })
            })
        })
    })

    describe('implementation common', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should change array when sent set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['tabread~'], 'tabread~', {
                            arrayName: 'UNKNOWN_ARRAY',
                        }),
                        nodeImplementation: nodeImplementations['tabread~'],
                        arrays: {
                            myArray: [1, 2, 3],
                        },
                    },
                    [{ ins: { '0': 1 } }, { outs: { '0': 0 } }],
                    [{ ins: { '0': 1 } }, { outs: { '0': 0 } }],
                    [
                        {
                            ins: {
                                '0': 1,
                                '0_message': [['set', 'myArray']],
                            },
                        },
                        { outs: { '0': 2 } },
                    ],
                    [{ ins: { '0': 1 } }, { outs: { '0': 2 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should update array when new array set %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['tabread~'], 'tabread~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation: nodeImplementations['tabread~'],
                        arrays: {},
                    },
                    [{ ins: { '0': 1 } }, { outs: { '0': 0 } }],
                    [
                        {
                            ins: { '0': 1 },
                            commons: { setArray: { myArray: [11, 22] } },
                        },
                        { outs: { '0': 22 } },
                    ],
                    [{ ins: { '0': 1 } }, { outs: { '0': 22 } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should clip input to array\'s bounds %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['tabread4~'], 'tabread4~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation: nodeImplementations['tabread4~'],
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                        },
                    },
                    [{ ins: { '0': -1 } }, { outs: { '0': 0.1 } }],
                    [{ ins: { '0': 100 } }, { outs: { '0': 0.7 } }],
                )
            }
        )
    })

    describe('implementation tabread~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read from sample when receiving float %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['tabread~'], 'tabread~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation: nodeImplementations['tabread~'],
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                        },
                    },
                    [{ ins: { '0': 3 } }, { outs: { '0': 0.4 } }],
                    [{ ins: { '0': 3.75 } }, { outs: { '0': 0.4 } }],
                    [{ ins: { '0': 4 } }, { outs: { '0': 0.5 } }]
                )
            }
        )
    })

    describe('implementation tabread4~', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read from sample when receiving float %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builders['tabread4~'], 'tabread4~', {
                            arrayName: 'myArray',
                        }),
                        nodeImplementation: nodeImplementations['tabread4~'],
                        arrays: {
                            myArray: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
                        },
                    },
                    [{ ins: { '0': 3 } }, { outs: { '0': 0.4 } }],
                    [{ ins: { '0': 3.75 } }, { outs: { '0': 0.4 } }],
                    [{ ins: { '0': 4 } }, { outs: { '0': 0.5 } }]
                )
            }
        )
    })
})
