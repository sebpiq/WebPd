
        const metadata: string = '{"libVersion":"0.1.0","customMetadata":{"pdNodes":{"0":{"0":{"id":"0","type":"text","args":["bla bla"],"nodeClass":"text","layout":{"x":101,"y":85}},"1":{"id":"1","type":"text","args":["hello"],"nodeClass":"text","layout":{"x":149,"y":125}}}},"graph":{},"pdGui":[{"nodeClass":"text","patchId":"0","pdNodeId":"0"},{"nodeClass":"text","patchId":"0","pdNodeId":"1"}]},"settings":{"audio":{"bitDepth":64,"channelCount":{"in":2,"out":2},"sampleRate":0,"blockSize":0},"io":{"messageReceivers":{},"messageSenders":{}}},"compilation":{"variableNamesIndex":{"io":{"messageReceivers":{},"messageSenders":{}},"globals":{"core":{"createFloatArray":"createFloatArray","x_createListOfArrays":"x_createListOfArrays","x_pushToListOfArrays":"x_pushToListOfArrays","x_getListOfArraysLength":"x_getListOfArraysLength","x_getListOfArraysElem":"x_getListOfArraysElem","x_getInput":"x_getInput","x_getOutput":"x_getOutput"},"commons":{"getArray":"G_commons_getArray","setArray":"G_commons_setArray"},"msg":{"writeStringToken":"G_msg_writeStringToken","writeFloatToken":"G_msg_writeFloatToken","readStringToken":"G_msg_readStringToken","readFloatToken":"G_msg_readFloatToken","FLOAT_TOKEN":"G_msg_FLOAT_TOKEN","STRING_TOKEN":"G_msg_STRING_TOKEN","x_create":"G_msg_x_create","x_getTokenTypes":"G_msg_x_getTokenTypes","x_createTemplate":"G_msg_x_createTemplate"}}}}}'

        
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
function G_msg_VOID_MESSAGE_RECEIVER(m: G_msg_Message): void {}
let G_msg_EMPTY_MESSAGE: G_msg_Message = G_msg_create([])
        

        
        


        
        
        

        export function initialize(sampleRate: Float, blockSize: Int): void {
            INPUT = createFloatArray(blockSize * 2)
            OUTPUT = createFloatArray(blockSize * 2)
            SAMPLE_RATE = sampleRate
            BLOCK_SIZE = blockSize

            
            
        }

        export function dspLoop(): void {
            
        for (IT_FRAME = 0; IT_FRAME < BLOCK_SIZE; IT_FRAME++) {
            G_commons__emitFrame(FRAME)
            
            FRAME++
        }
    
        }

        export {
            metadata,
            
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
    