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

import { FS_OPERATION_SUCCESS } from '@webpd/compiler'
import * as testHelpers from '@webpd/compiler/src/test-helpers'
import { nodeImplementation, builder } from './soundfiler'
import { buildNode, NODE_IMPLEMENTATION_TEST_PARAMETERS } from '../test-helpers'

describe('soundfiler', () => {
    describe('read files', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read soundfile into arrays, truncating the data to array size %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [10, 10],
                            array2: [20, 20],
                            array3: [30, 30],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [
                                        'read',
                                        '/some/url',
                                        'array1',
                                        'array2',
                                        'array3',
                                    ],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onReadSoundFile: [
                                    1,
                                    '/some/url',
                                    [3, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ],
                    [
                        {
                            fs: {
                                sendReadSoundFileResponse: [
                                    1,
                                    FS_OPERATION_SUCCESS,
                                    [
                                        new Float32Array([11, 12, 13]),
                                        new Float32Array([0, 0, 0]),
                                        new Float32Array([0, 0, 0]),
                                    ],
                                ],
                            },
                            commons: { getArray: ['array1', 'array2', 'array3'] },
                        },
                        {
                            outs: {
                                '0': [[2]],
                                '1': [[44100, -1, 3, 4, '']],
                            },
                            commons: {
                                getArray: {
                                    array1: [11, 12],
                                    array2: [0, 0],
                                    array3: [0, 0],
                                },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read soundfile resizing to array size if -resize %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [10, 10],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    ['read', '-resize', '/some/url', 'array1'],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onReadSoundFile: [
                                    1,
                                    '/some/url',
                                    [1, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ],
                    [
                        {
                            commons: { getArray: ['array1'] },
                            fs: {
                                sendReadSoundFileResponse: [
                                    1,
                                    FS_OPERATION_SUCCESS,
                                    [new Float32Array([11, 12, 13])],
                                ],
                            },
                        },
                        {
                            outs: { '0': [[3]], '1': [[44100, -1, 1, 4, '']] },
                            commons: {
                                getArray: {
                                    array1: [11, 12, 13],
                                },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read soundfile resizing to maxSize if -resize -maxsize <value> %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [1, 2, 3, 4, 5, 6],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [
                                        'read',
                                        '-resize',
                                        '-maxsize',
                                        2,
                                        '-skip',
                                        2,
                                        '/some/url',
                                        'array1',
                                    ],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onReadSoundFile: [
                                    1,
                                    '/some/url',
                                    [1, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ],
                    [
                        {
                            commons: { getArray: ['array1'] },
                            fs: {
                                sendReadSoundFileResponse: [
                                    1,
                                    FS_OPERATION_SUCCESS,
                                    [
                                        new Float32Array([
                                            11, 12, 13, 14, 15, 16,
                                        ]),
                                    ],
                                ],
                            },
                        },
                        {
                            outs: { '0': [[2]], '1': [[44100, -1, 1, 4, '']] },
                            commons: {
                                getArray: {
                                    array1: [13, 14],
                                },
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should read soundfile resizing to maxSize if -resize -maxsize <value> %s',
            async ({ target, bitDepth }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [10, 10],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [
                                        'read',
                                        '-resize',
                                        '-maxsize',
                                        3,
                                        '/some/url',
                                        'array1',
                                    ],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onReadSoundFile: [
                                    1,
                                    '/some/url',
                                    [1, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ],
                    [
                        {
                            commons: { getArray: ['array1'] },
                            fs: {
                                sendReadSoundFileResponse: [
                                    1,
                                    FS_OPERATION_SUCCESS,
                                    [new Float32Array([11, 12, 13])],
                                ],
                            },
                        },
                        {
                            outs: { '0': [[3]], '1': [[44100, -1, 1, 4, '']] },
                            commons: {
                                getArray: {
                                    array1: [11, 12, 13],
                                },
                            },
                        },
                    ]
                )
            }
        )
    })

    describe('write files', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should write from arrays to soundfile taking the biggest array %s',
            async ({ target, bitDepth, floatArrayType }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [10, 10],
                            array2: [20, 20, 20],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    ['write', '/some/url', 'array1', 'array2'],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onWriteSoundFile: [
                                    1,
                                    [
                                        new floatArrayType([10, 10, 0]),
                                        new floatArrayType([20, 20, 20]),
                                    ],
                                    '/some/url',
                                    [2, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ],
                    [
                        {
                            fs: {
                                sendWriteSoundFileResponse: [
                                    1,
                                    FS_OPERATION_SUCCESS,
                                ],
                            },
                        },
                        {
                            outs: {
                                '0': [[3]],
                                '1': [[44100, -1, 2, 4, '']],
                            },
                        },
                    ]
                )
            }
        )

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)(
            'should write from arrays to soundfile using skip and maxsize %s',
            async ({ target, bitDepth, floatArrayType }) => {
                await testHelpers.assertNodeOutput(
                    {
                        target,
                        bitDepth,
                        node: buildNode(builder, 'soundfiler', {}),
                        nodeImplementation,
                        arrays: {
                            array1: [11, 12],
                            array2: [21, 22, 23, 24, 25],
                        },
                    },
                    [
                        {
                            ins: {
                                '0': [
                                    [
                                        'write',
                                        '-skip',
                                        1,
                                        '-maxsize',
                                        2,
                                        '/some/url',
                                        'array1',
                                        'array2',
                                    ],
                                ],
                            },
                        },
                        {
                            outs: { '0': [], '1': [] },
                            fs: {
                                onWriteSoundFile: [
                                    1,
                                    [
                                        new floatArrayType([12, 0]),
                                        new floatArrayType([22, 23]),
                                    ],
                                    '/some/url',
                                    [2, 44100, 32, '', '', ''],
                                ],
                            },
                        },
                    ]
                )
            }
        )
    })

    describe('generic', () => {
        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should parse right sound file infos %s', async ({ target, bitDepth }) => {
            await testHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'soundfiler', {}),
                    nodeImplementation,
                    arrays: {
                        array1: [10, 10],
                    },
                },
                [
                    {
                        ins: {
                            '0': [
                                [
                                    'read',
                                    '-aiff',
                                    '-bytes',
                                    3,
                                    '-rate',
                                    22050,
                                    '-little',
                                    '/some/url',
                                    'array1',
                                ],
                            ],
                        },
                    },
                    {
                        outs: { '0': [], '1': [] },
                        fs: {
                            onReadSoundFile: [
                                1,
                                '/some/url',
                                [1, 22050, 24, 'aiff', 'l', ''],
                            ],
                        },
                    },
                ]
            )
        })

        it.each(NODE_IMPLEMENTATION_TEST_PARAMETERS)('should just do nothing if unknown array %s', async ({ target, bitDepth }) => {
            await testHelpers.assertNodeOutput(
                {
                    target,
                    bitDepth,
                    node: buildNode(builder, 'soundfiler', {}),
                    nodeImplementation,
                    arrays: {
                        array1: [0, 1, 2],
                    },
                },
                [
                    {
                        ins: {
                            '0': [
                                ['read', '/some/url', 'array1', 'unknownArray'],
                            ],
                        },
                    },
                    {
                        outs: { '0': [], '1': [] },
                    },
                ]
            )
        })
    })
})
