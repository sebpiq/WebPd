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

import { nodeImplementation, builder } from './_routemsg'
import {
    buildNode,
    NODE_IMPLEMENTATION_TEST_PARAMETERS,
} from '../test-helpers'
import * as testHelpers from '@webpd/compiler/src/test-helpers'

describe('_routemsg', () => {

    describe('implementation', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should send float messages to outlet 0 and the rest to outlet 1 %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, '_routemsg', {}),
                        nodeImplementation,
                    },
                    [
                        { ins: { '0': [[15.5], [15.5, 789], ['bla']] } },
                        { outs: { '0': [[15.5]], '1': [[15.5, 789], ['bla']] } },
                    ],
                )
            }
        )
    })
})
