
        const metadata: string = '{"libVersion":"0.1.0","audioSettings":{"bitDepth":64,"channelCount":{"in":2,"out":2},"sampleRate":0,"blockSize":0},"compilation":{"io":{"messageReceivers":{"n_0_1":{"portletIds":["0"],"metadata":{"group":"control:float","type":"nbx","label":"","position":[99,43],"initValue":220,"minValue":-1e+37,"maxValue":1e+37}}},"messageSenders":{}},"variableNamesIndex":{"io":{"messageReceivers":{"n_0_1":{"0":"IORCV_n_0_1_0"}},"messageSenders":{}}}}}'

        
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
function x_core_createListOfArrays(): FloatArray[] {
                    const arrays: FloatArray[] = []
                    return arrays
                }
function x_core_pushToListOfArrays(arrays: FloatArray[], array: FloatArray): void {
                    arrays.push(array)
                }
function x_core_getListOfArraysLength(arrays: FloatArray[]): Int {
                    return arrays.length
                }
function x_core_getListOfArraysElem(arrays: FloatArray[], index: Int): FloatArray {
                    return arrays[index]
                }

            type SkedCallback = (event: SkedEvent) => void
            type SkedId = Int
            type SkedMode = Int
            type SkedEvent = string
        
const SKED_ID_NULL: SkedId = -1
const SKED_ID_COUNTER_INIT: SkedId = 1
const _SKED_WAIT_IN_PROGRESS: Int = 0
const _SKED_WAIT_OVER: Int = 1
const _SKED_MODE_WAIT: Int = 0
const _SKED_MODE_SUBSCRIBE: Int = 1
class SkedRequest {
id: SkedId
mode: SkedMode
callback: SkedCallback
}
class Skeduler {
events: Map<SkedEvent, Array<SkedId>>
requests: Map<SkedId, SkedRequest>
isLoggingEvents: boolean
eventLog: Set<SkedEvent>
idCounter: SkedId
}
function sked_create(isLoggingEvents: boolean): Skeduler {
            return {
                eventLog: new Set(),
                events: new Map(),
                requests: new Map(),
                idCounter: SKED_ID_COUNTER_INIT,
                isLoggingEvents,
            }
        }
function sked_wait(skeduler: Skeduler, event: SkedEvent, callback: SkedCallback): SkedId {
            if (skeduler.isLoggingEvents === false) {
                throw new Error("Please activate skeduler's isLoggingEvents")
            }

            if (skeduler.eventLog.has(event)) {
                callback(event)
                return SKED_ID_NULL
            } else {
                return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
            }
        }
function sked_wait_future(skeduler: Skeduler, event: SkedEvent, callback: SkedCallback): SkedId {
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
        }
function sked_subscribe(skeduler: Skeduler, event: SkedEvent, callback: SkedCallback): SkedId {
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE)
        }
function sked_emit(skeduler: Skeduler, event: SkedEvent): void {
            if (skeduler.isLoggingEvents === true) {
                skeduler.eventLog.add(event)
            }
            if (skeduler.events.has(event)) {
                const skedIds: Array<SkedId> = skeduler.events.get(event)
                const skedIdsStaying: Array<SkedId> = []
                for (let i: Int = 0; i < skedIds.length; i++) {
                    if (skeduler.requests.has(skedIds[i])) {
                        const request: SkedRequest = skeduler.requests.get(skedIds[i])
                        request.callback(event)
                        if (request.mode === _SKED_MODE_WAIT) {
                            skeduler.requests.delete(request.id)
                        } else {
                            skedIdsStaying.push(request.id)
                        }
                    }
                }
                skeduler.events.set(event, skedIdsStaying)
            }
        }
function sked_cancel(skeduler: Skeduler, id: SkedId): void {
            skeduler.requests.delete(id)
        }
function _sked_createRequest(skeduler: Skeduler, event: SkedEvent, callback: SkedCallback, mode: SkedMode): SkedId {
            const id: SkedId = _sked_nextId(skeduler)
            const request: SkedRequest = {
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
function _sked_nextId(skeduler: Skeduler): SkedId {
            return skeduler.idCounter++
        }
const _commons_ARRAYS: Map<string, FloatArray> = new Map()
const _commons_ARRAYS_SKEDULER: Skeduler = sked_create(false)
function commons_getArray(arrayName: string): FloatArray {
            if (!_commons_ARRAYS.has(arrayName)) {
                throw new Error('Unknown array ' + arrayName)
            }
            return _commons_ARRAYS.get(arrayName)
        }
function commons_hasArray(arrayName: string): boolean {
            return _commons_ARRAYS.has(arrayName)
        }
function commons_setArray(arrayName: string, array: FloatArray): void {
            _commons_ARRAYS.set(arrayName, array)
            sked_emit(_commons_ARRAYS_SKEDULER, arrayName)
        }
function commons_subscribeArrayChanges(arrayName: string, callback: SkedCallback): SkedId {
            const id = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback)
            if (_commons_ARRAYS.has(arrayName)) {
                callback(arrayName)
            }
            return id
        }
function commons_cancelArrayChangesSubscription(id: SkedId): void {
            sked_cancel(_commons_ARRAYS_SKEDULER, id)
        }
const _commons_FRAME_SKEDULER: Skeduler = sked_create(false)
function _commons_emitFrame(frame: Int): void {
            sked_emit(_commons_FRAME_SKEDULER, frame.toString())
        }
function commons_waitFrame(frame: Int, callback: SkedCallback): SkedId {
            return sked_wait_future(_commons_FRAME_SKEDULER, frame.toString(), callback)
        }
function commons_cancelWaitFrame(id: SkedId): void {
            sked_cancel(_commons_FRAME_SKEDULER, id)
        }

                type MessageFloatToken = Float
                type MessageCharToken = Int

                type MessageTemplate = Array<Int>
                type MessageHeaderEntry = Int
                type MessageHeader = Int32Array

                type MessageHandler = (m: Message) => void
                
const MSG_FLOAT_TOKEN: MessageHeaderEntry = 0
const MSG_STRING_TOKEN: MessageHeaderEntry = 1
function x_msg_create(templateTypedArray: Int32Array): Message {
                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return msg_create(template)
                }
function x_msg_getTokenTypes(message: Message): MessageHeader {
                    return message.tokenTypes
                }
function x_msg_createTemplate(length: i32): Int32Array {
                    return new Int32Array(length)
                }
function msg_create(template: MessageTemplate): Message {
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<MessageHeaderEntry> = []
                    let tokenPositions: Array<MessageHeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case MSG_FLOAT_TOKEN:
                                byteCount += sizeof<MessageFloatToken>()
                                tokenTypes.push(MSG_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case MSG_STRING_TOKEN:
                                byteCount += sizeof<MessageCharToken>() * template[i + 1]
                                tokenTypes.push(MSG_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<MessageHeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<MessageHeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    const header = _msg_unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: _msg_unpackTokenTypes(header),
                        tokenPositions: _msg_unpackTokenPositions(header),
                    }
                }
function msg_writeStringToken(message: Message, tokenIndex: Int, value: string): void {
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<MessageCharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                }
function msg_writeFloatToken(message: Message, tokenIndex: Int, value: MessageFloatToken): void {
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                }
function msg_readStringToken(message: Message, tokenIndex: Int): string {
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                    }
                    return value
                }
function msg_readFloatToken(message: Message, tokenIndex: Int): MessageFloatToken {
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                }
function msg_getLength(message: Message): Int {
                    return message.tokenTypes.length
                }
function msg_getTokenType(message: Message, tokenIndex: Int): Int {
                    return message.tokenTypes[tokenIndex]
                }
function msg_isStringToken(message: Message, tokenIndex: Int): boolean {
                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                }
function msg_isFloatToken(message: Message, tokenIndex: Int): boolean {
                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                }
function msg_isMatching(message: Message, tokenTypes: Array<MessageHeaderEntry>): boolean {
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
function msg_floats(values: Array<Float>): Message {
                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                }
function msg_strings(values: Array<string>): Message {
                    const template: MessageTemplate = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(MSG_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: Message = msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeStringToken(message, i, values[i])
                    }
                    return message
                }
function msg_display(message: Message): string {
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < msg_getLength(message); i++) {
                        if (msg_isFloatToken(message, i)) {
                            displayArray.push(msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                }
class Message {
dataView: DataView
header: MessageHeader
tokenCount: MessageHeaderEntry
tokenTypes: MessageHeader
tokenPositions: MessageHeader
}
function _msg_computeHeaderLength(tokenCount: Int): Int {
                    return 1 + tokenCount * 2 + 1
                }
function _msg_unpackTokenCount(messageDataView: DataView): MessageHeaderEntry {
                    return messageDataView.getInt32(0)
                }
function _msg_unpackHeader(messageDataView: DataView, tokenCount: MessageHeaderEntry): MessageHeader {
                    const headerLength = _msg_computeHeaderLength(tokenCount)
                    // TODO : why is this `wrap` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                    }
                    return messageHeader
                }
function _msg_unpackTokenTypes(header: MessageHeader): MessageHeader {
                    return header.slice(1, 1 + header[0])
                }
function _msg_unpackTokenPositions(header: MessageHeader): MessageHeader {
                    return header.slice(1 + header[0])
                }
function msg_isBang(message: Message): boolean {
            return (
                msg_isStringToken(message, 0) 
                && msg_readStringToken(message, 0) === 'bang'
            )
        }
function msg_bang(): Message {
            const message: Message = msg_create([MSG_STRING_TOKEN, 4])
            msg_writeStringToken(message, 0, 'bang')
            return message
        }
function msg_emptyToBang(message: Message): Message {
            if (msg_getLength(message) === 0) {
                return msg_bang()
            } else {
                return message
            }
        }
const MSG_BUSES: Map<string, Array<MessageHandler>> = new Map()
function msgBusPublish(busName: string, message: Message): void {
            let i: Int = 0
            const callbacks: Array<MessageHandler> = MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        }
function msgBusSubscribe(busName: string, callback: MessageHandler): void {
            if (!MSG_BUSES.has(busName)) {
                MSG_BUSES.set(busName, [])
            }
            MSG_BUSES.get(busName).push(callback)
        }
function msgBusUnsubscribe(busName: string, callback: MessageHandler): void {
            if (!MSG_BUSES.has(busName)) {
                return
            }
            const callbacks: Array<MessageHandler> = MSG_BUSES.get(busName)
            const found: Int = callbacks.indexOf(callback) !== -1
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
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
class NT_nbx_State {
minValue: Float
maxValue: Float
valueFloat: Float
value: Message
receiveBusName: string
sendBusName: string
messageReceiver: MessageHandler
messageSender: MessageHandler
}
function NT_nbx_setReceiveBusName(state: NT_nbx_State, busName: string): void {
            if (state.receiveBusName !== "empty") {
                msgBusUnsubscribe(state.receiveBusName, state.messageReceiver)
            }
            state.receiveBusName = busName
            if (state.receiveBusName !== "empty") {
                msgBusSubscribe(state.receiveBusName, state.messageReceiver)
            }
        }
function NT_nbx_setSendReceiveFromMessage(state: NT_nbx_State, m: Message): boolean {
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'receive'
            ) {
                NT_nbx_setReceiveBusName(state, msg_readStringToken(m, 1))
                return true

            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'send'
            ) {
                state.sendBusName = msg_readStringToken(m, 1)
                return true
            }
            return false
        }
function NT_nbx_defaultMessageHandler(m: Message): void {}
function NT_nbx_receiveMessage(state: NT_nbx_State, m: Message): void {
                    if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                        state.valueFloat = Math.min(Math.max(msg_readFloatToken(m, 0),state.minValue),state.maxValue)
                        const outMessage: Message = msg_floats([state.valueFloat])
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "empty") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (msg_isBang(m)) {
                        
                        const outMessage: Message = msg_floats([state.valueFloat])
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "empty") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (
                        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                        && msg_readStringToken(m, 0) === 'set'
                    ) {
                        state.valueFloat = Math.min(Math.max(msg_readFloatToken(m, 1),state.minValue),state.maxValue)
                        return
                    
                    } else if (NT_nbx_setSendReceiveFromMessage(state, m) === true) {
                        return
                    }
                }


class NT_sig_t_State {
currentValue: Float
}






        let F: Int = 0
let FRAME: Int = 0
let BLOCK_SIZE: Int = 0
let SAMPLE_RATE: Float = 0
let NULL_SIGNAL: Float = 0
function SND_TO_NULL(m: Message): void {}
let EMPTY_MESSAGE: Message = msg_create([])
        let INPUT: FloatArray = createFloatArray(0)
        let OUTPUT: FloatArray = createFloatArray(0)

        

        const N_n_0_1_state: NT_nbx_State = {
                                minValue: -1e+37,
maxValue: 1e+37,
valueFloat: 220,
value: msg_create([]),
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
        
function N_n_0_1_rcvs_0(m: Message): void {
                            
                NT_nbx_receiveMessage(N_n_0_1_state, m)
                return
            
                            throw new Error('Node type "nbx", id "n_0_1", inlet "0", unsupported message : ' + msg_display(m))
                        }

function N_m_n_0_0_0__routemsg_rcvs_0(m: Message): void {
                            
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                N_m_n_0_0_0__routemsg_snds_0(m)
                return
            } else {
                SND_TO_NULL(m)
                return
            }
        
                            throw new Error('Node type "_routemsg", id "m_n_0_0_0__routemsg", inlet "0", unsupported message : ' + msg_display(m))
                        }
let N_m_n_0_0_0_sig_outs_0: Float = 0
function N_m_n_0_0_0_sig_rcvs_0(m: Message): void {
                            
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            N_m_n_0_0_0_sig_state.currentValue = msg_readFloatToken(m, 0)
            return
        }
    
                            throw new Error('Node type "sig~", id "m_n_0_0_0_sig", inlet "0", unsupported message : ' + msg_display(m))
                        }


let N_n_0_0_outs_0: Float = 0



function N_m_n_0_0_0__routemsg_snds_0(m: Message): void {
                        N_m_n_0_0_0_sig_rcvs_0(m)
COLD_0(m)
                    }

        function COLD_0(m: Message): void {
                    N_m_n_0_0_0_sig_outs_0 = N_m_n_0_0_0_sig_state.currentValue
                    NT_osc_t_setStep(N_n_0_0_state, N_m_n_0_0_0_sig_outs_0)
                }
        function IORCV_n_0_1_0(m: Message): void {
                    N_n_0_1_rcvs_0(m)
                }
        

        export function initialize(sampleRate: Float, blockSize: Int): void {
            INPUT = createFloatArray(blockSize * 2)
            OUTPUT = createFloatArray(blockSize * 2)
            SAMPLE_RATE = sampleRate
            BLOCK_SIZE = blockSize

            
                N_n_0_1_state.messageSender = N_m_n_0_0_0__routemsg_rcvs_0
                N_n_0_1_state.messageReceiver = function (m: Message): void {
                    NT_nbx_receiveMessage(N_n_0_1_state, m)
                }
                NT_nbx_setReceiveBusName(N_n_0_1_state, "empty")
    
                commons_waitFrame(0, () => N_m_n_0_0_0__routemsg_rcvs_0(msg_floats([N_n_0_1_state.valueFloat])))
            




            NT_osc_t_setStep(N_n_0_0_state, 0)
        

            COLD_0(EMPTY_MESSAGE)
        }

        export function getInput(): FloatArray { return INPUT }

        export function getOutput(): FloatArray { return OUTPUT }

        export function dspLoop(): void {
            
        for (F = 0; F < BLOCK_SIZE; F++) {
            _commons_emitFrame(FRAME)
            
                N_n_0_0_outs_0 = Math.cos(N_n_0_0_state.phase)
                N_n_0_0_state.phase += N_n_0_0_state.step
            
OUTPUT[F + BLOCK_SIZE * 0] = N_n_0_0_outs_0
OUTPUT[F + BLOCK_SIZE * 1] = N_n_0_0_outs_0
            FRAME++
        }
    
        }

        export {
            metadata,
            IORCV_n_0_1_0,
        }

        
export { x_core_createListOfArrays }
export { x_core_pushToListOfArrays }
export { x_core_getListOfArraysLength }
export { x_core_getListOfArraysElem }
export { createFloatArray }
export { commons_getArray }
export { commons_setArray }
export { x_msg_create }
export { x_msg_getTokenTypes }
export { x_msg_createTemplate }
export { msg_writeStringToken }
export { msg_writeFloatToken }
export { msg_readStringToken }
export { msg_readFloatToken }
export { MSG_FLOAT_TOKEN }
export { MSG_STRING_TOKEN }
    