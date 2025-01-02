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
    Code,
    CompilerTarget,
    dspGraph,
    DspGraph,
    EngineMetadata,
} from '@webpd/compiler'
import { Artefacts, WebPdMetadata } from '../../types'
import WEBPD_RUNTIME_CODE from './assets/runtime.js.txt'
import { readMetadata } from '@webpd/compiler'
import { traversePdGui } from '../../../pd-gui'
import { PdGuiNode } from '../../../pd-gui/types'
import { NodeArguments as NodeArgumentsSendReceive } from '../../../nodes/nodes/send-receive'
import { PdJson } from '@webpd/pd-parser'
export const WEBPD_RUNTIME_FILENAME = 'webpd-runtime.js'

export interface Settings {
    artefacts: Artefacts
}

export type GeneratedApp = { [filename: string]: string | ArrayBuffer }

export default async (artefacts: Artefacts): Promise<GeneratedApp> => {
    if (!artefacts.javascript && !artefacts.wasm) {
        throw new Error(`Needs at least javascript or wasm to run`)
    }

    let target: CompilerTarget
    let compiledPatchFilename: string
    let engineMetadata: EngineMetadata
    let compiledPatchCode: string | ArrayBuffer

    if (artefacts.javascript) {
        target = 'javascript'
        compiledPatchFilename = 'patch.js'
        engineMetadata = await readMetadata('javascript', artefacts.javascript)
        compiledPatchCode = artefacts.javascript
    } else {
        target = 'assemblyscript'
        compiledPatchFilename = 'patch.wasm'
        engineMetadata = await readMetadata('assemblyscript', artefacts.wasm)
        compiledPatchCode = artefacts.wasm
    }

    const webPdMetadata =
        engineMetadata.customMetadata as unknown as WebPdMetadata
    if (!webPdMetadata.pdGui || !webPdMetadata.graph || !webPdMetadata.pdNodes) {
        throw new Error(`Missing data in WebPd metadata`)
    }

    const generatedApp: GeneratedApp = {
        [WEBPD_RUNTIME_FILENAME]: WEBPD_RUNTIME_CODE,
        [compiledPatchFilename]: compiledPatchCode,
        // prettier-ignore
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
            // 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT


            // ------------- 1. WEB PAGE INITIALIZATION
            const loadingDiv = document.querySelector('#loading')
            const startButton = document.querySelector('#start')
            const audioContext = new AudioContext()

            let patch = null
            let stream = null
            let webpdNode = null

            const initApp = async () => {
                // Register the worklet
                await WebPdRuntime.initialize(audioContext)

                // Fetch the patch code
                response = await fetch('${compiledPatchFilename}')
                patch = await ${target === 'javascript' ? 
                    'response.text()': 'response.arrayBuffer()'}

                // Comment this if you don't need audio input
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
                webpdNode = await WebPdRuntime.run(
                    audioContext, 
                    patch, 
                    WebPdRuntime.defaultSettingsForRun(
                        './${compiledPatchFilename}',
                        // Comment this if you don't need to receive messages from the patch
                        receiveMsgFromWebPd,
                    ),
                )
                webpdNode.connect(audioContext.destination)

                // Comment this if you don't need audio input
                const sourceNode = audioContext.createMediaStreamSource(stream)
                sourceNode.connect(webpdNode)

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
                    type: 'io:messageReceiver',
                    payload: {
                        nodeId,
                        portletId,
                        message,
                    },
                })
            }
            
            // Here is an index of objects IDs to which you can send messages, with hints so you can find the right ID.
            // Note that by default only GUI objects (bangs, sliders, etc ...) are available.${
                renderIoMessageReceiversOrSenders(
                    engineMetadata.settings.io.messageReceivers,
                    webPdMetadata,
                    // Render controls
                    (node, portletId, layout) => `
            //  - nodeId "${node.id}" portletId "${portletId}"
            //      * type "${node.type}"
            //      * position ${layout.x} ${layout.y}${
                layout.label ? `
            //      * label "${layout.label}"` : ''}
            `, 
                    // Render send/receive
                    (node, portletId) => `
            //  - nodeId "${node.id}" portletId "${portletId}"
            //      * type "send"
            //      * send "${node.args.busName}"
            `,
                    // Render if empty io specs
                    `
            // EMPTY (did you place a GUI object or send object in your patch ?)
`)}

            // ------------- 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT
            // Use the function receiveMsgFromWebPd to receive a message from an object inside your patch.
            // 
            // Parameters : 
            // - nodeId: the ID of the object that is sending a message. 
            //          This ID is a string that has been assigned by WebPd at compilation.
            //          You can find below the list of available IDs with hints to help you 
            //          identify the object you want to interact with.
            // - portletId : the ID of the object portlet that is sending the message.
            // - message : the message that was sent. It is a list of strings and / or numbers.
            const receiveMsgFromWebPd = (nodeId, portletId, message) => {${
                renderIoMessageReceiversOrSenders(
                    engineMetadata.settings.io.messageSenders,
                    webPdMetadata,
                    // Render controls
                    (node, portletId, layout) => `
                if (nodeId === "${node.id}" && portletId === "${portletId}") {
                    console.log('Message received from :\\n'
                        + '\t* nodeId "${node.id}" portletId "${portletId}"\\n'
                        + '\t* type "${node.type}"\\n'
                        + '\t* position ${layout.x} ${layout.y}\\n'${
                    layout.label ? `
                        + '\t* label "${layout.label}"'` : ''}
                    )
                }`,
                    // Render send/receive
                    (node, portletId) => `
                if (nodeId === "${node.id}" && portletId === "${portletId}") {
                    console.log('Message received from :\\n'
                        + '\t* nodeId "${node.id}" portletId "${portletId}"\\n'
                        + '\t* type "receive"\\n'
                        + '\t* receive "${node.args.busName}"'
                    )
                }`,
                    // Render if empty io specs
                    `
                // /!\ there seems to be no message senders in the patch. 
                // Add a GUI object or a send object in your patch to be able to receive messages.
`)}                
            }

        </script>
    </body>
</html>`,
    }
    return generatedApp
}

const renderIoMessageReceiversOrSenders = (
    ioMessageSpecs: EngineMetadata['settings']['io'][
        | 'messageReceivers'
        | 'messageSenders'],
    webPdMetadata: WebPdMetadata,
    renderControl: (
        node: DspGraph.Node,
        portletId: DspGraph.PortletId,
        layout: PdJson.ControlNode['layout']
    ) => Code,
    renderSendReceive: (
        node: DspGraph.Node<NodeArgumentsSendReceive>,
        portletId: DspGraph.PortletId
    ) => Code,
    emptyString: string
) => {
    if (Object.keys(ioMessageSpecs).length) {
        const indexedPdGuiNodes: { [nodeId: DspGraph.NodeId]: PdGuiNode } = {}
        traversePdGui(webPdMetadata.pdGui, (pdGuiNode) => {
            if (pdGuiNode.nodeClass === 'control') {
                indexedPdGuiNodes[pdGuiNode.nodeId] = pdGuiNode
            }
        })

        return Object.entries(ioMessageSpecs)
            .flatMap(([nodeId, portletIds]) =>
                portletIds.map((portletId) => {
                    const node = dspGraph.getters.getNode(
                        webPdMetadata.graph,
                        nodeId
                    )

                    if (node.type === 'send' || node.type === 'receive') {
                        return renderSendReceive(
                            node as DspGraph.Node<NodeArgumentsSendReceive>,
                            portletId
                        )
                    }

                    const pdGuiNode = indexedPdGuiNodes[nodeId]
                    if (!pdGuiNode) {
                        return ''
                    } else if (pdGuiNode.nodeClass === 'control') {
                        const pdNode =
                            webPdMetadata.pdNodes[pdGuiNode.patchId][pdGuiNode.pdNodeId]
                        return renderControl(node, portletId, pdNode.layout)
                    } else {
                        return ''
                    }
                })
            )
            .join('')
    } else {
        return emptyString
    }
}
