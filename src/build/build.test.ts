import { makePd } from '@webpd/pd-parser/src/test-helpers'
import { createArtefacts, performBuildStep } from './build'
import assert from 'assert'
import { IoMessageSpecs } from '@webpd/compiler/src/compile/types'
import { builders as buildersSendReceive } from '../nodes/nodes/send-receive'
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
                            group: 'gui',
                            type: 'msg',
                            args: ['bli'],
                            position: [11, 22],
                            label: 'bli-msg',
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
                }
            )
        })
    })
})
