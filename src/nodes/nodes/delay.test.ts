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

import * as nodeImplementationsTestHelpers from '@webpd/compiler-js/src/test-helpers-node-implementations'
import { nodeImplementation, builder } from './delay'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS, testNodeTranslateArgs } from '../test-helpers'

describe('delay', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should have defaults', () => {
                testNodeTranslateArgs(builder, [], {
                    delay: 0,
                    unit: 'msec',
                    unitAmount: 1,
                })
                testNodeTranslateArgs(builder, [100, 10, 'seconds'], {
                    delay: 100,
                    unit: 'seconds',
                    unitAmount: 10,
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should start delay passed as arg on bang or start %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'delay', {
                            delay: 2,
                            unit: 'samples',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }],
                    [{ ins: { '0': [['start']] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should cancel previous delay %s', async ({ target, bitDepth }) => {
            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'delay', {
                        delay: 2,
                        unit: 'samples',
                        unitAmount: 1,
                    }),
                    nodeImplementation,
                },
                [{}, { outs: { '0': [] } }],
                [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                [{}, { outs: { '0': [] } }],
                [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                [{}, { outs: { '0': [] } }],
                [{}, { outs: { '0': [['bang']] } }]
            )
        })

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should stop the delay on stop %s', async ({ target, bitDepth }) => {
            await nodeImplementationsTestHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'delay', {
                        delay: 2,
                        unit: 'samples',
                        unitAmount: 1,
                    }),
                    nodeImplementation,
                },
                [{}, { outs: { '0': [] } }],
                [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                [{ ins: { '0': [['stop']] } }, { outs: { '0': [] } }],
                [{}, { outs: { '0': [] } }],
                [{}, { outs: { '0': [] } }]
            )
        })

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the delay and start it on float %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'delay', {
                            delay: 2,
                            unit: 'samples',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '0': [[3]] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the time unit on tempo message %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'delay', {
                            delay: 2,
                            unit: 'samples',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [
                        { ins: { '0': [['tempo', 2, 'samp'], ['bang']] } },
                        { outs: { '0': [] } },
                    ],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should set the delay with message on inlet 1 %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'delay', {
                            delay: 2,
                            unit: 'samples',
                            unitAmount: 1,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                    [{ ins: { '1': [[1]] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should work with different time unit %s',
            async ({ target, bitDepth }) => {
                await nodeImplementationsTestHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'delay', {
                            delay: 2,
                            unit: 'sec',
                            unitAmount: 2 / 44100,
                        }),
                        nodeImplementation,
                    },
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [['bang']] } }],
                    [{}, { outs: { '0': [] } }],
                )
            }
        )
    })
})
