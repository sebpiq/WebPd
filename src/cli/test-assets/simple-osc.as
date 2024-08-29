
        const metadata: string = '{"libVersion":"0.1.0","settings":{"audio":{"bitDepth":64,"channelCount":{"in":2,"out":2},"sampleRate":0,"blockSize":0},"io":{"messageReceivers":{"n_0_1":{"portletIds":["0"],"metadata":{"group":"control:float","type":"nbx","label":"","position":[99,43],"initValue":220,"minValue":-1e+37,"maxValue":1e+37}}},"messageSenders":{}}},"compilation":{"variableNamesIndex":{"io":{"messageReceivers":{"n_0_1":{"0":"IO_rcv_n_0_1_0"}},"messageSenders":{}},"globals":{"core":{"createFloatArray":"createFloatArray","x_createListOfArrays":"x_createListOfArrays","x_pushToListOfArrays":"x_pushToListOfArrays","x_getListOfArraysLength":"x_getListOfArraysLength","x_getListOfArraysElem":"x_getListOfArraysElem","x_getInput":"x_getInput","x_getOutput":"x_getOutput"},"commons":{"getArray":"G_commons_getArray","setArray":"G_commons_setArray"},"msg":{"writeStringToken":"G_msg_writeStringToken","writeFloatToken":"G_msg_writeFloatToken","readStringToken":"G_msg_readStringToken","readFloatToken":"G_msg_readFloatToken","FLOAT_TOKEN":"G_msg_FLOAT_TOKEN","STRING_TOKEN":"G_msg_STRING_TOKEN","x_create":"G_msg_x_create","x_getTokenTypes":"G_msg_x_getTokenTypes","x_createTemplate":"G_msg_x_createTemplate"}}}}}'

        
                type FloatArray = Float64Array
                type Float = f64
                type Int = i32
                
function toInt(v: Float): Int {
                    return i32(v)
                }
function toFloat(v: Int): Float {
                    return f64(v)
                }
function createFloatArray(length: Int): FloatArray {
                    return new Float64Array(length)
                }
function setFloatDataView(dataView: DataView, position: Int, value: Float): void {
                    dataView.setFloat64(position, value)
                }
function getFloatDataView(dataView: DataView, position: Int): Float {
                    return dataView.getFloat64(position)
                }
function x_createListOfArrays(): FloatArray[] {
                    const arrays: FloatArray[] = []
                    return arrays
                }
function x_pushToListOfArrays(arrays: FloatArray[], array: FloatArray): void {
                    arrays.push(array)
                }
function x_getListOfArraysLength(arrays: FloatArray[]): Int {
                    return arrays.length
                }
function x_getListOfArraysElem(arrays: FloatArray[], index: Int): FloatArray {
                    return arrays[index]
                }
function x_getInput(): FloatArray {
                    return INPUT
                }
function x_getOutput(): FloatArray {
                    return OUTPUT
                }
let IT_FRAME: Int = 0
let FRAME: Int = 0
let BLOCK_SIZE: Int = 0
let SAMPLE_RATE: Float = 0
let NULL_SIGNAL: Float = 0
let INPUT: FloatArray = createFloatArray(0)
let OUTPUT: FloatArray = createFloatArray(0)

                type G_sked_Callback = (event: G_sked_Event) => void
                type G_sked_Id = Int
                type G_sked_Mode = Int
                type G_sked_Event = string
            
const G_sked_ID_NULL: G_sked_Id = -1
const G_sked__ID_COUNTER_INIT: G_sked_Id = 1
const G_sked__MODE_WAIT: Int = 0
const G_sked__MODE_SUBSCRIBE: Int = 1
class G_sked__Request {
id: G_sked_Id
mode: G_sked_Mode
callback: G_sked_Callback
}
class G_sked_Skeduler {
events: Map<G_sked_Event, Array<G_sked_Id>>
requests: Map<G_sked_Id, G_sked__Request>
isLoggingEvents: boolean
eventLog: Set<G_sked_Event>
idCounter: G_sked_Id
}
function G_sked_create(isLoggingEvents: boolean): G_sked_Skeduler {
                return {
                    eventLog: new Set(),
                    events: new Map(),
                    requests: new Map(),
                    idCounter: G_sked__ID_COUNTER_INIT,
                    isLoggingEvents,
                }
            }
function G_sked_wait(skeduler: G_sked_Skeduler, event: G_sked_Event, callback: G_sked_Callback): G_sked_Id {
                if (skeduler.isLoggingEvents === false) {
                    throw new Error("Please activate skeduler's isLoggingEvents")
                }

                if (skeduler.eventLog.has(event)) {
                    callback(event)
                    return G_sked_ID_NULL
                } else {
                    return G_sked__createRequest(skeduler, event, callback, G_sked__MODE_WAIT)
                }
            }
function G_sked_waitFuture(skeduler: G_sked_Skeduler, event: G_sked_Event, callback: G_sked_Callback): G_sked_Id {
                return G_sked__createRequest(skeduler, event, callback, G_sked__MODE_WAIT)
            }
function G_sked_subscribe(skeduler: G_sked_Skeduler, event: G_sked_Event, callback: G_sked_Callback): G_sked_Id {
                return G_sked__createRequest(skeduler, event, callback, G_sked__MODE_SUBSCRIBE)
            }
function G_sked_emit(skeduler: G_sked_Skeduler, event: G_sked_Event): void {
                if (skeduler.isLoggingEvents === true) {
                    skeduler.eventLog.add(event)
                }
                if (skeduler.events.has(event)) {
                    const skedIds: Array<G_sked_Id> = skeduler.events.get(event)
                    const skedIdsStaying: Array<G_sked_Id> = []
                    for (let i: Int = 0; i < skedIds.length; i++) {
                        if (skeduler.requests.has(skedIds[i])) {
                            const request: G_sked__Request = skeduler.requests.get(skedIds[i])
                            request.callback(event)
                            if (request.mode === G_sked__MODE_WAIT) {
                                skeduler.requests.delete(request.id)
                            } else {
                                skedIdsStaying.push(request.id)
                            }
                        }
                    }
                    skeduler.events.set(event, skedIdsStaying)
                }
            }
function G_sked_cancel(skeduler: G_sked_Skeduler, id: G_sked_Id): void {
                skeduler.requests.delete(id)
            }
function G_sked__createRequest(skeduler: G_sked_Skeduler, event: G_sked_Event, callback: G_sked_Callback, mode: G_sked_Mode): G_sked_Id {
                const id: G_sked_Id = G_sked__nextId(skeduler)
                const request: G_sked__Request = {
                    id, 
                    mode, 
                    callback,
                }
                skeduler.requests.set(id, request)
                if (!skeduler.events.has(event)) {
                    skeduler.events.set(event, [id])    
                } else {
                    skeduler.events.get(event).push(id)
                }
                return id
            }
function G_sked__nextId(skeduler: G_sked_Skeduler): G_sked_Id {
                return skeduler.idCounter++
            }
const G_commons__ARRAYS: Map<string, FloatArray> = new Map()
const G_commons__ARRAYS_SKEDULER: G_sked_Skeduler = G_sked_create(false)
function G_commons_getArray(arrayName: string): FloatArray {
            if (!G_commons__ARRAYS.has(arrayName)) {
                throw new Error('Unknown array ' + arrayName)
            }
            return G_commons__ARRAYS.get(arrayName)
        }
function G_commons_hasArray(arrayName: string): boolean {
            return G_commons__ARRAYS.has(arrayName)
        }
function G_commons_setArray(arrayName: string, array: FloatArray): void {
            G_commons__ARRAYS.set(arrayName, array)
            G_sked_emit(G_commons__ARRAYS_SKEDULER, arrayName)
        }
function G_commons_subscribeArrayChanges(arrayName: string, callback: G_sked_Callback): G_sked_Id {
            const id = G_sked_subscribe(G_commons__ARRAYS_SKEDULER, arrayName, callback)
            if (G_commons__ARRAYS.has(arrayName)) {
                callback(arrayName)
            }
            return id
        }
function G_commons_cancelArrayChangesSubscription(id: G_sked_Id): void {
            G_sked_cancel(G_commons__ARRAYS_SKEDULER, id)
        }

const G_commons__FRAME_SKEDULER: G_sked_Skeduler = G_sked_create(false)
function G_commons__emitFrame(frame: Int): void {
            G_sked_emit(G_commons__FRAME_SKEDULER, frame.toString())
        }
function G_commons_waitFrame(frame: Int, callback: G_sked_Callback): G_sked_Id {
            return G_sked_waitFuture(G_commons__FRAME_SKEDULER, frame.toString(), callback)
        }
function G_commons_cancelWaitFrame(id: G_sked_Id): void {
            G_sked_cancel(G_commons__FRAME_SKEDULER, id)
        }

                type G_msg_Template = Array<Int>
                
                type G_msg__FloatToken = Float
                type G_msg__CharToken = Int

                type G_msg__HeaderEntry = Int

                type G_msg_Handler = (m: G_msg_Message) => void
                
const G_msg_FLOAT_TOKEN: G_msg__HeaderEntry = 0
const G_msg_STRING_TOKEN: G_msg__HeaderEntry = 1
function G_msg_create(template: G_msg_Template): G_msg_Message {
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<G_msg__HeaderEntry> = []
                    let tokenPositions: Array<G_msg__HeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case G_msg_FLOAT_TOKEN:
                                byteCount += sizeof<G_msg__FloatToken>()
                                tokenTypes.push(G_msg_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case G_msg_STRING_TOKEN:
                                byteCount += sizeof<G_msg__CharToken>() * template[i + 1]
                                tokenTypes.push(G_msg_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = G_msg__computeHeaderLength(tokenCount) 
                        * sizeof<G_msg__HeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<G_msg__HeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<G_msg__HeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<G_msg__HeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<G_msg__HeaderEntry>()
                    }

                    const header = G_msg__unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: G_msg__unpackTokenTypes(header),
                        tokenPositions: G_msg__unpackTokenPositions(header),
                    }
                }
function G_msg_writeStringToken(message: G_msg_Message, tokenIndex: Int, value: string): void {
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<G_msg__CharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<G_msg__CharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                }
function G_msg_writeFloatToken(message: G_msg_Message, tokenIndex: Int, value: G_msg__FloatToken): void {
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                }
function G_msg_readStringToken(message: G_msg_Message, tokenIndex: Int): string {
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<G_msg__CharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<G_msg__CharToken>() * i))
                    }
                    return value
                }
function G_msg_readFloatToken(message: G_msg_Message, tokenIndex: Int): G_msg__FloatToken {
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                }
function G_msg_getLength(message: G_msg_Message): Int {
                    return message.tokenTypes.length
                }
function G_msg_getTokenType(message: G_msg_Message, tokenIndex: Int): Int {
                    return message.tokenTypes[tokenIndex]
                }
function G_msg_isStringToken(message: G_msg_Message, tokenIndex: Int): boolean {
                    return G_msg_getTokenType(message, tokenIndex) === G_msg_STRING_TOKEN
                }
function G_msg_isFloatToken(message: G_msg_Message, tokenIndex: Int): boolean {
                    return G_msg_getTokenType(message, tokenIndex) === G_msg_FLOAT_TOKEN
                }
function G_msg_isMatching(message: G_msg_Message, tokenTypes: Array<G_msg__HeaderEntry>): boolean {
                    if (message.tokenTypes.length !== tokenTypes.length) {
                        return false
                    }
                    for (let i: Int = 0; i < tokenTypes.length; i++) {
                        if (message.tokenTypes[i] !== tokenTypes[i]) {
                            return false
                        }
                    }
                    return true
                }
function G_msg_floats(values: Array<Float>): G_msg_Message {
                    const message: G_msg_Message = G_msg_create(
                        values.map<G_msg__HeaderEntry>(v => G_msg_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        G_msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                }
function G_msg_strings(values: Array<string>): G_msg_Message {
                    const template: G_msg_Template = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(G_msg_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: G_msg_Message = G_msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        G_msg_writeStringToken(message, i, values[i])
                    }
                    return message
                }
function G_msg_display(message: G_msg_Message): string {
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < G_msg_getLength(message); i++) {
                        if (G_msg_isFloatToken(message, i)) {
                            displayArray.push(G_msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + G_msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                }
class G_msg_Message {
dataView: DataView
header: G_msg__Header
tokenCount: G_msg__HeaderEntry
tokenTypes: G_msg__Header
tokenPositions: G_msg__Header
}
function G_msg_x_create(templateTypedArray: Int32Array): G_msg_Message {
                    const template: G_msg_Template = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return G_msg_create(template)
                }
function G_msg_x_getTokenTypes(message: G_msg_Message): G_msg__Header {
                    return message.tokenTypes
                }
function G_msg_x_createTemplate(length: i32): Int32Array {
                    return new Int32Array(length)
                }
type G_msg__Header = Int32Array
function G_msg__computeHeaderLength(tokenCount: Int): Int {
                    return 1 + tokenCount * 2 + 1
                }
function G_msg__unpackHeader(messageDataView: DataView, tokenCount: G_msg__HeaderEntry): G_msg__Header {
                    const headerLength = G_msg__computeHeaderLength(tokenCount)
                    // TODO : why is this `wrap` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<G_msg__HeaderEntry>() * i)
                    }
                    return messageHeader
                }
function G_msg__unpackTokenTypes(header: G_msg__Header): G_msg__Header {
                    return header.slice(1, 1 + header[0])
                }
function G_msg__unpackTokenPositions(header: G_msg__Header): G_msg__Header {
                    return header.slice(1 + header[0])
                }
function G_msg_nullMessageReceiver(m: G_msg_Message): void {}
let G_msg_emptyMessage: G_msg_Message = G_msg_create([])
function G_bangUtils_isBang(message: G_msg_Message): boolean {
            return (
                G_msg_isStringToken(message, 0) 
                && G_msg_readStringToken(message, 0) === 'bang'
            )
        }
function G_bangUtils_bang(): G_msg_Message {
            const message: G_msg_Message = G_msg_create([G_msg_STRING_TOKEN, 4])
            G_msg_writeStringToken(message, 0, 'bang')
            return message
        }
function G_bangUtils_emptyToBang(message: G_msg_Message): G_msg_Message {
            if (G_msg_getLength(message) === 0) {
                return G_bangUtils_bang()
            } else {
                return message
            }
        }
const G_msgBuses__BUSES: Map<string, Array<G_msg_Handler>> = new Map()
function G_msgBuses_publish(busName: string, message: G_msg_Message): void {
            let i: Int = 0
            const callbacks: Array<G_msg_Handler> = G_msgBuses__BUSES.has(busName) ? G_msgBuses__BUSES.get(busName): []
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        }
function G_msgBuses_subscribe(busName: string, callback: G_msg_Handler): void {
            if (!G_msgBuses__BUSES.has(busName)) {
                G_msgBuses__BUSES.set(busName, [])
            }
            G_msgBuses__BUSES.get(busName).push(callback)
        }
function G_msgBuses_unsubscribe(busName: string, callback: G_msg_Handler): void {
            if (!G_msgBuses__BUSES.has(busName)) {
                return
            }
            const callbacks: Array<G_msg_Handler> = G_msgBuses__BUSES.get(busName)
            const found: Int = callbacks.indexOf(callback)
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
        }
        class NT_nbx_State {
minValue: Float
maxValue: Float
valueFloat: Float
value: G_msg_Message
receiveBusName: string
sendBusName: string
messageReceiver: G_msg_Handler
messageSender: G_msg_Handler
}
function NT_nbx_setReceiveBusName(state: NT_nbx_State, busName: string): void {
            if (state.receiveBusName !== "empty") {
                G_msgBuses_unsubscribe(state.receiveBusName, state.messageReceiver)
            }
            state.receiveBusName = busName
            if (state.receiveBusName !== "empty") {
                G_msgBuses_subscribe(state.receiveBusName, state.messageReceiver)
            }
        }
function NT_nbx_setSendReceiveFromMessage(state: NT_nbx_State, m: G_msg_Message): boolean {
            if (
                G_msg_isMatching(m, [G_msg_STRING_TOKEN, G_msg_STRING_TOKEN])
                && G_msg_readStringToken(m, 0) === 'receive'
            ) {
                NT_nbx_setReceiveBusName(state, G_msg_readStringToken(m, 1))
                return true

            } else if (
                G_msg_isMatching(m, [G_msg_STRING_TOKEN, G_msg_STRING_TOKEN])
                && G_msg_readStringToken(m, 0) === 'send'
            ) {
                state.sendBusName = G_msg_readStringToken(m, 1)
                return true
            }
            return false
        }
function NT_nbx_defaultMessageHandler(m: G_msg_Message): void {}
function NT_nbx_receiveMessage(state: NT_nbx_State, m: G_msg_Message): void {
                    if (G_msg_isMatching(m, [G_msg_FLOAT_TOKEN])) {
                        state.valueFloat = Math.min(Math.max(G_msg_readFloatToken(m, 0),state.minValue),state.maxValue)
                        const outMessage: G_msg_Message = G_msg_floats([state.valueFloat])
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "empty") {
                            G_msgBuses_publish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (G_bangUtils_isBang(m)) {
                        
                        const outMessage: G_msg_Message = G_msg_floats([state.valueFloat])
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "empty") {
                            G_msgBuses_publish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (
                        G_msg_isMatching(m, [G_msg_STRING_TOKEN, G_msg_FLOAT_TOKEN]) 
                        && G_msg_readStringToken(m, 0) === 'set'
                    ) {
                        state.valueFloat = Math.min(Math.max(G_msg_readFloatToken(m, 1),state.minValue),state.maxValue)
                        return
                    
                    } else if (NT_nbx_setSendReceiveFromMessage(state, m) === true) {
                        return
                    }
                }


class NT_sig_t_State {
currentValue: Float
}



class NT_osc_t_State {
phase: Float
step: Float
}
function NT_osc_t_setStep(state: NT_osc_t_State, freq: Float): void {
                    state.step = (2 * Math.PI / SAMPLE_RATE) * freq
                }
function NT_osc_t_setPhase(state: NT_osc_t_State, phase: Float): void {
                    state.phase = phase % 1.0 * 2 * Math.PI
                }



        const N_n_0_1_state: NT_nbx_State = {
                                minValue: -1e+37,
maxValue: 1e+37,
valueFloat: 220,
value: G_msg_create([]),
receiveBusName: "empty",
sendBusName: "empty",
messageReceiver: NT_nbx_defaultMessageHandler,
messageSender: NT_nbx_defaultMessageHandler,
                            }
const N_m_n_0_0_0_sig_state: NT_sig_t_State = {
                                currentValue: 0,
                            }
const N_n_0_0_state: NT_osc_t_State = {
                                phase: 0,
step: 0,
                            }
        
function N_n_0_1_rcvs_0(m: G_msg_Message): void {
                            
                NT_nbx_receiveMessage(N_n_0_1_state, m)
                return
            
                            throw new Error('Node "n_0_1", inlet "0", unsupported message : ' + G_msg_display(m))
                        }

function N_m_n_0_0_0__routemsg_rcvs_0(m: G_msg_Message): void {
                            
            if (G_msg_isMatching(m, [G_msg_FLOAT_TOKEN])) {
                N_m_n_0_0_0__routemsg_snds_0(m)
                return
            } else {
                G_msg_nullMessageReceiver(m)
                return
            }
        
                            throw new Error('Node "m_n_0_0_0__routemsg", inlet "0", unsupported message : ' + G_msg_display(m))
                        }
let N_m_n_0_0_0_sig_outs_0: Float = 0
function N_m_n_0_0_0_sig_rcvs_0(m: G_msg_Message): void {
                            
    if (G_msg_isMatching(m, [G_msg_FLOAT_TOKEN])) {
        N_m_n_0_0_0_sig_state.currentValue = G_msg_readFloatToken(m, 0)
        return
    }

                            throw new Error('Node "m_n_0_0_0_sig", inlet "0", unsupported message : ' + G_msg_display(m))
                        }


let N_n_0_0_outs_0: Float = 0



function N_m_n_0_0_0__routemsg_snds_0(m: G_msg_Message): void {
                        N_m_n_0_0_0_sig_rcvs_0(m)
COLD_0(m)
                    }

        function COLD_0(m: G_msg_Message): void {
                    N_m_n_0_0_0_sig_outs_0 = N_m_n_0_0_0_sig_state.currentValue
                    NT_osc_t_setStep(N_n_0_0_state, N_m_n_0_0_0_sig_outs_0)
                }
        function IO_rcv_n_0_1_0(m: G_msg_Message): void {
                    N_n_0_1_rcvs_0(m)
                }
        

        export function initialize(sampleRate: Float, blockSize: Int): void {
            INPUT = createFloatArray(blockSize * 2)
            OUTPUT = createFloatArray(blockSize * 2)
            SAMPLE_RATE = sampleRate
            BLOCK_SIZE = blockSize

            
                N_n_0_1_state.messageSender = N_m_n_0_0_0__routemsg_rcvs_0
                N_n_0_1_state.messageReceiver = function (m: G_msg_Message): void {
                    NT_nbx_receiveMessage(N_n_0_1_state, m)
                }
                NT_nbx_setReceiveBusName(N_n_0_1_state, "empty")
    
                G_commons_waitFrame(0, () => N_m_n_0_0_0__routemsg_rcvs_0(G_msg_floats([N_n_0_1_state.valueFloat])))
            




            NT_osc_t_setStep(N_n_0_0_state, 0)
        

            COLD_0(G_msg_emptyMessage)
        }

        export function dspLoop(): void {
            
        for (IT_FRAME = 0; IT_FRAME < BLOCK_SIZE; IT_FRAME++) {
            G_commons__emitFrame(FRAME)
            
                N_n_0_0_outs_0 = Math.cos(N_n_0_0_state.phase)
                N_n_0_0_state.phase += N_n_0_0_state.step
            
OUTPUT[IT_FRAME + BLOCK_SIZE * 0] = N_n_0_0_outs_0
OUTPUT[IT_FRAME + BLOCK_SIZE * 1] = N_n_0_0_outs_0
            FRAME++
        }
    
        }

        export {
            metadata,
            IO_rcv_n_0_1_0,
        }

        
export { x_createListOfArrays }
export { x_pushToListOfArrays }
export { x_getListOfArraysLength }
export { x_getListOfArraysElem }
export { x_getInput }
export { x_getOutput }
export { createFloatArray }
export { G_commons_getArray }
export { G_commons_setArray }
export { G_msg_x_create }
export { G_msg_x_getTokenTypes }
export { G_msg_x_createTemplate }
export { G_msg_writeStringToken }
export { G_msg_writeFloatToken }
export { G_msg_readStringToken }
export { G_msg_readFloatToken }
export { G_msg_FLOAT_TOKEN }
export { G_msg_STRING_TOKEN }
    