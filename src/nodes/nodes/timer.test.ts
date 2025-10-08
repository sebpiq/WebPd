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
import { nodeImplementation, builder } from './timer'

const SAMPLE_RATE = testHelpers.ENGINE_DSP_PARAMS.sampleRate

describe('timer', () => {
    describe('builder', () => {
        describe('translateArgs', () => {
            it('should handle args as expected', () => {
                testNodeTranslateArgs(builder, [], {
                    unitAmount: 1,
                    unit: 'msec',
                })
                testNodeTranslateArgs(builder, [13, 'seconds'], {
                    unitAmount: 13,
                    unit: 'seconds',
                })
            })
        })
    })

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time since beginning if not banged %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[3]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time since last time banged on inlet 0 %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '0': [['bang']] } }, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[1]] } }]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should mesure ellapsed time in the unit that was configured %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'timer', {
                            unitAmount: 1,
                            unit: 'samp',
                        }),
                        nodeImplementation,
                    },
                    [{}, { outs: { '0': [] } }],
                    [{ins: { '0': [['tempo', 2/SAMPLE_RATE, 'seconds']] }}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{}, { outs: { '0': [] } }],
                    [{ ins: { '1': [['bang']] } }, { outs: { '0': [[2.5]] } }],
                )
            }
        )
    })
})
