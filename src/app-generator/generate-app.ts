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
import { PdJson } from '@webpd/pd-parser'
import { Artefacts } from '../build/types'
import WEBPD_RUNTIME_CODE from './runtime.generated.js.txt'
import { buildGraphNodeId } from '../compile-dsp-graph/to-dsp-graph'
export const WEBPD_RUNTIME_FILENAME = 'webpd-runtime.js'

export interface Settings {
    artefacts: Artefacts
}

export type GeneratedApp = { [filename: string]: string | ArrayBuffer }

type Template = 'bare-bones'

export default (template: Template, artefacts: Artefacts): GeneratedApp => {
    switch (template) {
        case 'bare-bones':
            const generated = bareBonesApp({ artefacts })
            return {
                ...generated,
                [WEBPD_RUNTIME_FILENAME]: WEBPD_RUNTIME_CODE,
            }
        default:
            throw new Error(`Unknown template ${template}`)
    }
}

const bareBonesApp = (settings: Settings) => {
    const { artefacts } = settings
    if (!artefacts.compiledJs && !artefacts.wasm) {
        throw new Error(`Needs at least compiledJs or wasm to run`)
    }
    const compiledPatchFilename = artefacts.compiledJs
        ? 'patch.js'
        : 'patch.wasm'
    // prettier-ignore
    const generatedApp: GeneratedApp = {
        'index.html': `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>WebPd boilerplate</title>
        <style>
            #start {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            #loading {
                width: 100%;
                height: 100%;
                position: fixed;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                justify-content: center;
                align-items: center;
            }
        </style>
    </head>
    <body>
        <h1>My Web Page</h1>
        <div>For more info about usage (how to interact with the patch), you can open this HTML file in a code editor.</div>
        <button id="start"> Start </button>
        <div id="loading"> Loading ... </div>
        <script src="${WEBPD_RUNTIME_FILENAME}"></script>
        <script>
            // SUMMARY
            // 1. WEB PAGE INITIALIZATION
            // 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
            // 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT (coming soon ...)


            // ------------- 1. WEB PAGE INITIALIZATION
            const loadingDiv = document.querySelector('#loading')
            const startButton = document.querySelector('#start')
            const audioContext = new AudioContext()

            let patch = null
            let stream = null
            let webpdNode = null

            const initApp = async () => {
                // Register the worklet
                await WebPdRuntime.registerWebPdWorkletNode(audioContext)

                // Fetch the patch code
                response = await fetch('${compiledPatchFilename}')
                patch = await ${artefacts.compiledJs ? 
                    'response.text()': 'response.arrayBuffer()'}

                // Get audio input
                stream = await navigator.mediaDevices.getUserMedia({ audio: true })

		// Comment the line above and uncomment the lines below if you
		// don't want to use the microphone.

		// var node = audioContext.createMediaStreamDestination()
		// stream = node.stream

                // Hide loading and show start button
                loadingDiv.style.display = 'none'
                startButton.style.display = 'block'
            }

            const startApp = async () => {
                // AudioContext needs to be resumed on click to protects users 
                // from being spammed with autoplay.
                // See : https://github.com/WebAudio/web-audio-api/issues/345
                if (audioContext.state === 'suspended') {
                    audioContext.resume()
                }

                // Setup web audio graph
                const sourceNode = audioContext.createMediaStreamSource(stream)
                webpdNode = new WebPdRuntime.WebPdWorkletNode(audioContext)
                sourceNode.connect(webpdNode)
                webpdNode.connect(audioContext.destination)

                // Setup filesystem management
                webpdNode.port.onmessage = (message) => 
                    WebPdRuntime.fsWeb(webpdNode, message, { 
                        rootUrl: WebPdRuntime.urlDirName(location.pathname) 
                    })

                // Send code to the worklet
                ${artefacts.compiledJs ? `
                webpdNode.port.postMessage({
                    type: 'code:JS',
                    payload: {
                        jsCode: patch,
                    },
                })`: `
                webpdNode.port.postMessage({
                    type: 'code:WASM',
                    payload: {
                        wasmBuffer: patch,
                    },
                })`}

                // Hide the start button
                startButton.style.display = 'none'
            }

            startButton.onclick = startApp

            initApp().
                then(() => {
                    console.log('App initialized')
                })

            
            // ------------- 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
            // Use the function sendMsgToWebPd to send a message from JavaScript to an object inside your patch.
            // 
            // Parameters : 
            // - nodeId: the ID of the object you want to send a message to. 
            //          This ID is a string that has been assigned by WebPd at compilation.
            //          You can find below the list of available IDs with hints to help you 
            //          identify the object you want to interact with.
            // - portletId : the ID of the object portlet to which the message should be sent. 
            // - message : the message to send. This must be a list of strings and / or numbers.
            // 
            // Examples :
            // - sending a message to a bang node of ID 'n_0_1' :
            //          sendMsgToWebPd('n_0_1', '0', ['bang'])
            // - sending a message to a number object of ID 'n_0_2' :
            //          sendMsgToWebPd('n_0_2', '0', [123])
            // 
            const sendMsgToWebPd = (nodeId, portletId, message) => {
                webpdNode.port.postMessage({
                    type: 'inletCaller',
                    payload: {
                        nodeId,
                        portletId,
                        message,
                    },
                })
            }
            
            // Here is an index of objects IDs to which you can send messages, with hints so you can find the right ID.
            // Note that by default only GUI objects (bangs, sliders, etc ...) are available.${
                artefacts.dspGraph 
                && artefacts.dspGraph.inletCallerSpecs 
                && Object.keys(artefacts.dspGraph.inletCallerSpecs).length ? 
                    Object.entries(artefacts.dspGraph.inletCallerSpecs)
                        .flatMap(([nodeId, portletIds]) => portletIds.map(portletId => {
                            const pdNode = resolvePdNodeFromGraphNodeId(artefacts.pdJson!, nodeId)
                            if (!pdNode) {
                                throw new Error(`Failed to resolve pd node`)
                            }
                            return `
            //  - nodeId "${nodeId}" portletId "${portletId}"
            //      * type "${pdNode.type}"
            //      * args ${JSON.stringify(pdNode.args)}`
            + ((pdNode.layout as any).label ? `
            //      * label "${(pdNode.layout as any).label}"` : '')
                        })).join('')
                : `
            // EMPTY (did you place a GUI object in your patch ?)
`}


            // ------------- 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT
            // Coming soon ... 

        </script>
    </body>
</html>`
    }

    if (artefacts.compiledJs) {
        generatedApp[compiledPatchFilename] = artefacts.compiledJs
    } else {
        generatedApp[compiledPatchFilename] = artefacts.wasm
    }

    return generatedApp
}

const resolvePdNodeFromGraphNodeId = (
    pd: PdJson.Pd,
    graphNodeId: PdJson.LocalId
): PdJson.Node | null => {
    let node: PdJson.Node = null
    Object.entries(pd.patches).some(([patchId, patch]) => {
        node = Object.values(patch.nodes).find(
            (node) => buildGraphNodeId(patchId, node.id) === graphNodeId
        )
        return !!node
    })
    return node
}
