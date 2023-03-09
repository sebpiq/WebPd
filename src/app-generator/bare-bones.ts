import { GeneratedApp, Settings, WEBPD_RUNTIME_FILENAME } from "./types"

export default (settings: Settings) => {
    if (!settings.artefacts.compiledJs && !settings.artefacts.wasm) {
        throw new Error(`Needs at least compiledJs or wasm to run`)
    }
    const compiledPatchFilename = settings.artefacts.compiledJs ? 'patch.js': 'patch.wasm'
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

            const startWebPdNode = async () => {
                const sourceNode = audioContext.createMediaStreamSource(stream)
                webpdNode = new WebPdRuntime.WebPdWorkletNode(audioContext)
                sourceNode.connect(webpdNode)
                webpdNode.connect(audioContext.destination)
                webpdNode.port.onmessage = (message) => WebPdRuntime.fs.web(webpdNode, message)
                ${settings.artefacts.compiledJs ? `
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
            }

            const initApp = async () => {
                await WebPdRuntime.registerWebPdWorkletNode(audioContext)
                response = await fetch('${compiledPatchFilename}')
                patch = await ${settings.artefacts.compiledJs ? 
                    'response.text()': 'response.arrayBuffer()'}
                stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                loadingDiv.style.display = 'none'
                startButton.style.display = 'block'
            }

            const startApp = async () => {
                await startWebPdNode()
                startButton.style.display = 'none'
                startWebPdNode(audioContext, stream)
            }

            startButton.onclick = startApp

            initApp().
                then(() => {
                    console.log('App initialized')
                })
        </script>
    </body>
</html>`
    }

    if (settings.artefacts.compiledJs) {
        generatedApp[compiledPatchFilename] = settings.artefacts.compiledJs
    } else {
        generatedApp[compiledPatchFilename] = settings.artefacts.wasm
    }

    return generatedApp
}