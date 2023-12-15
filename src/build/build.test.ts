import { makePd } from '@webpd/pd-parser/src/test-helpers'
import { createArtefacts, performBuildStep } from './build'
import assert from 'assert'
import { IoMessageSpecs } from '@webpd/compiler/src/compile/types'
import { builders as buildersSendReceive } from '../nodes/nodes/send-receive'
import { builders as buildersControlsFloat } from '../nodes/nodes/controls-float'
import { builder } from '../nodes/nodes/msg'

describe('build', () => {
    describe('preformBuildStep', () => {
        it('should add automatically generated messageReceivers for GUI and [send]', async () => {
            const artefacts = createArtefacts()
            artefacts.pdJson = makePd({
                patches: {
                    '0': {
                        nodes: {
                            '1': {
                                type: 'msg',
                                args: ['bli'],
                                nodeClass: 'control',
                                layout: {
                                    x: 11,
                                    y: 22,
                                    label: 'bli-msg',
                                } as any,
                            },
                            '2': {
                                type: 'send',
                                args: ['bla'],
                                nodeClass: 'generic',
                                layout: {
                                    x: 33,
                                    y: 44,
                                },
                            },
                            '3': {
                                type: 'hsl',
                                args: [0, 127, 1, 44.4, 'empty', 'empty'],
                                nodeClass: 'control',
                                layout: {
                                    x: 55,
                                    y: 66,
                                    label: 'blu-hsl',
                                } as any,
                            },
                        },
                    },
                },
            })

            await performBuildStep(artefacts, 'dspGraph', {
                audioSettings: {
                    channelCount: { in: 1, out: 1 },
                    bitDepth: 64,
                },
                renderAudioSettings: {
                    sampleRate: 44100,
                    blockSize: 64,
                    previewDurationSeconds: 1,
                },
                nodeBuilders: {
                    msg: builder,
                    hsl: buildersControlsFloat.hsl,
                    send: buildersSendReceive.send,
                },
                nodeImplementations: {},
                abstractionLoader: () =>
                    Promise.reject('could not load abstraction'),
            })

            assert.deepStrictEqual<IoMessageSpecs>(
                artefacts.dspGraph.io.messageReceivers,
                {
                    n_0_1: {
                        portletIds: ['0'],
                        metadata: {
                            group: 'control',
                            type: 'msg',
                            label: 'bli-msg',
                            position: [11, 22],
                        },
                    },
                    n_0_2: {
                        portletIds: ['0'],
                        metadata: {
                            group: 'send',
                            name: 'bla',
                            position: [33, 44],
                        },
                    },
                    n_0_3: {
                        portletIds: ['0'],
                        metadata: {
                            group: 'control:float',
                            type: 'hsl',
                            label: 'blu-hsl',
                            minValue: 0,
                            maxValue: 127,
                            initValue: 44.4,
                            position: [55, 66],
                        },
                    },
                }
            )
        })
    })
})
