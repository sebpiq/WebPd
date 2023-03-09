import { Artefacts } from '../build/types'
import WEBPD_RUNTIME_CODE from './runtime.generated.js.txt'
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
                display: flex;
                justify-content: center;
                align-items: center;
            }
        </style>
    </head>
    <body>
        <button id="start"> Start </button>
        <div id="loading"> Loading ... </div>
        <script src="${WEBPD_RUNTIME_FILENAME}"></script>
        <script>
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
                webpdNode.port.onmessage = (message) => WebPdRuntime.fs.web(webpdNode, message)

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

            // You can then use this function to interact with your patch
            // e.g. :
            // sendMsgToWebPd('n_0_1', '0', ['bang'])
            // sendMsgToWebPd('n_0_2', '0', [123])
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
            ${artefacts.dspGraph && artefacts.dspGraph.inletCallerSpecs ? `
            // For info, compilation has opened the following ports in your patch.
            // You can send messages to them :` 
                + Object.entries(artefacts.dspGraph.inletCallerSpecs)
                    .flatMap(([nodeId, portletIds]) => portletIds.map(portletId => `
            //     - Node of type "${artefacts.dspGraph.graph[nodeId].type}", nodeId "${nodeId}", portletId "${portletId}"`)).join('')
                : ''}
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
