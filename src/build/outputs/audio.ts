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
import {
    AudioSettings,
    CompilerTarget,
    createAssemblyScriptWasmEngine,
    createJavaScriptEngine,
    Engine,
    FloatArray,
    getFloatArrayType,
} from '@webpd/compiler'
import * as wavefile from 'wavefile'
import { getArtefact } from '../helpers'
import { Artefacts, RenderAudioSettings } from '../types'

type CombinedAudioSettings = AudioSettings & RenderAudioSettings

export const renderWav = async (
    durationSeconds: number,
    artefacts: Artefacts,
    audioSettings: CombinedAudioSettings
) => {
    let target: CompilerTarget = 'assemblyscript'
    if (!artefacts.wasm && !artefacts.javascript) {
        throw new Error(`Need compiled wasm or compiled js to render wav`)
    }
    if (!artefacts.wasm) {
        target = 'javascript'
    }

    const engine = await createEngine(artefacts, target)
    const audioData = await renderAudioData(engine, durationSeconds, audioSettings)
    return audioDataToWav(audioData, audioSettings.sampleRate)
}

const audioDataToWav = (audioData: Array<FloatArray>, sampleRate: number) => {
    const channelCount = audioData.length
    let wav = new wavefile.WaveFile()
    wav.fromScratch(
        channelCount,
        sampleRate,
        '32f',
        audioData.map((channelData) =>
            channelData.map((v) => v)
        )
    )
    return wav.toBuffer()
}

const createEngine = async (
    artefacts: Artefacts,
    target: CompilerTarget,
): Promise<Engine> => {
    switch (target) {
        case 'javascript':
            return createJavaScriptEngine(getArtefact(artefacts, 'javascript'))

        case 'assemblyscript':
            return createAssemblyScriptWasmEngine(getArtefact(artefacts, 'wasm'))
    }
}

const renderAudioData = (
    engine: Engine,
    durationSeconds: number,
    audioSettings: CombinedAudioSettings,
): Array<FloatArray> => {
    const { channelCount, sampleRate, blockSize } = audioSettings
    const durationSamples = Math.round(durationSeconds * sampleRate)
    const blockInput = _makeBlock('in', audioSettings)
    const blockOutput = _makeBlock('out', audioSettings)
    const output = _makeBlock('out', audioSettings, durationSamples)

    engine.initialize(sampleRate, blockSize)
    let frame = 0
    while (frame < durationSamples) {
        engine.dspLoop(blockInput, blockOutput)
        for (let channel = 0; channel < channelCount.out; channel++) {
            output[channel].set(
                blockOutput[channel].slice(
                    0,
                    Math.min(blockSize, durationSamples - frame)
                ),
                frame
            )
        }
        frame += blockSize
    }

    return output
}

const _makeBlock = (
    inOrOut: keyof AudioSettings['channelCount'],
    audioSettings: CombinedAudioSettings,
    blockSize?: number
) => {
    const {
        channelCount,
        blockSize: defaultBlockSize,
        bitDepth,
    } = audioSettings
    if (blockSize === undefined) {
        blockSize = defaultBlockSize
    }
    const floatArrayType = getFloatArrayType(bitDepth)
    const block: Array<FloatArray> = []
    for (let channel = 0; channel < channelCount[inOrOut]; channel++) {
        block.push(new floatArrayType(Math.round(blockSize)))
    }
    return block
}
