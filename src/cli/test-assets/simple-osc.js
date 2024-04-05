
        
                const i32 = (v) => v
                const f32 = i32
                const f64 = i32
                
function toInt(v) {
                    return v
                }
function toFloat(v) {
                    return v
                }
function createFloatArray(length) {
                    return new Float64Array(length)
                }
function setFloatDataView(dataView, position, value) {
                    dataView.setFloat64(position, value)
                }
function getFloatDataView(dataView, position) {
                    return dataView.getFloat64(position)
                }
const SKED_ID_NULL = -1
const SKED_ID_COUNTER_INIT = 1
const _SKED_WAIT_IN_PROGRESS = 0
const _SKED_WAIT_OVER = 1
const _SKED_MODE_WAIT = 0
const _SKED_MODE_SUBSCRIBE = 1


function sked_create(isLoggingEvents) {
            return {
                eventLog: new Set(),
                events: new Map(),
                requests: new Map(),
                idCounter: SKED_ID_COUNTER_INIT,
                isLoggingEvents,
            }
        }
function sked_wait(skeduler, event, callback) {
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
function sked_wait_future(skeduler, event, callback) {
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
        }
function sked_subscribe(skeduler, event, callback) {
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE)
        }
function sked_emit(skeduler, event) {
            if (skeduler.isLoggingEvents === true) {
                skeduler.eventLog.add(event)
            }
            if (skeduler.events.has(event)) {
                const skedIds = skeduler.events.get(event)
                const skedIdsStaying = []
                for (let i = 0; i < skedIds.length; i++) {
                    if (skeduler.requests.has(skedIds[i])) {
                        const request = skeduler.requests.get(skedIds[i])
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
function sked_cancel(skeduler, id) {
            skeduler.requests.delete(id)
        }
function _sked_createRequest(skeduler, event, callback, mode) {
            const id = _sked_nextId(skeduler)
            const request = {
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
function _sked_nextId(skeduler) {
            return skeduler.idCounter++
        }
const _commons_ARRAYS = new Map()
const _commons_ARRAYS_SKEDULER = sked_create(false)
function commons_getArray(arrayName) {
            if (!_commons_ARRAYS.has(arrayName)) {
                throw new Error('Unknown array ' + arrayName)
            }
            return _commons_ARRAYS.get(arrayName)
        }
function commons_hasArray(arrayName) {
            return _commons_ARRAYS.has(arrayName)
        }
function commons_setArray(arrayName, array) {
            _commons_ARRAYS.set(arrayName, array)
            sked_emit(_commons_ARRAYS_SKEDULER, arrayName)
        }
function commons_subscribeArrayChanges(arrayName, callback) {
            const id = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback)
            if (_commons_ARRAYS.has(arrayName)) {
                callback(arrayName)
            }
            return id
        }
function commons_cancelArrayChangesSubscription(id) {
            sked_cancel(_commons_ARRAYS_SKEDULER, id)
        }
const _commons_FRAME_SKEDULER = sked_create(false)
function _commons_emitFrame(frame) {
            sked_emit(_commons_FRAME_SKEDULER, frame.toString())
        }
function commons_waitFrame(frame, callback) {
            return sked_wait_future(_commons_FRAME_SKEDULER, frame.toString(), callback)
        }
function commons_cancelWaitFrame(id) {
            sked_cancel(_commons_FRAME_SKEDULER, id)
        }
const MSG_FLOAT_TOKEN = "number"
const MSG_STRING_TOKEN = "string"
function msg_create(template) {
                    const m = []
                    let i = 0
                    while (i < template.length) {
                        if (template[i] === MSG_STRING_TOKEN) {
                            m.push('')
                            i += 2
                        } else if (template[i] === MSG_FLOAT_TOKEN) {
                            m.push(0)
                            i += 1
                        }
                    }
                    return m
                }
function msg_getLength(message) {
                    return message.length
                }
function msg_getTokenType(message, tokenIndex) {
                    return typeof message[tokenIndex]
                }
function msg_isStringToken(message, tokenIndex) {
                    return msg_getTokenType(message, tokenIndex) === 'string'
                }
function msg_isFloatToken(message, tokenIndex) {
                    return msg_getTokenType(message, tokenIndex) === 'number'
                }
function msg_isMatching(message, tokenTypes) {
                    return (message.length === tokenTypes.length) 
                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])
                }
function msg_writeFloatToken(message, tokenIndex, value) {
                    message[tokenIndex] = value
                }
function msg_writeStringToken(message, tokenIndex, value) {
                    message[tokenIndex] = value
                }
function msg_readFloatToken(message, tokenIndex) {
                    return message[tokenIndex]
                }
function msg_readStringToken(message, tokenIndex) {
                    return message[tokenIndex]
                }
function msg_floats(values) {
                    return values
                }
function msg_strings(values) {
                    return values
                }
function msg_display(message) {
                    return '[' + message
                        .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
                        .join(', ') + ']'
                }
function msg_isBang(message) {
            return (
                msg_isStringToken(message, 0) 
                && msg_readStringToken(message, 0) === 'bang'
            )
        }
function msg_bang() {
            const message = msg_create([MSG_STRING_TOKEN, 4])
            msg_writeStringToken(message, 0, 'bang')
            return message
        }
function msg_emptyToBang(message) {
            if (msg_getLength(message) === 0) {
                return msg_bang()
            } else {
                return message
            }
        }
const MSG_BUSES = new Map()
function msgBusPublish(busName, message) {
            let i = 0
            const callbacks = MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        }
function msgBusSubscribe(busName, callback) {
            if (!MSG_BUSES.has(busName)) {
                MSG_BUSES.set(busName, [])
            }
            MSG_BUSES.get(busName).push(callback)
        }
function msgBusUnsubscribe(busName, callback) {
            if (!MSG_BUSES.has(busName)) {
                return
            }
            const callbacks = MSG_BUSES.get(busName)
            const found = callbacks.indexOf(callback) !== -1
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
        }
        
function NT_osc_t_setStep(state, freq) {
                    state.step = (2 * Math.PI / SAMPLE_RATE) * freq
                }
function NT_osc_t_setPhase(state, phase) {
                    state.phase = phase % 1.0 * 2 * Math.PI
                }

function NT_nbx_setReceiveBusName(state, busName) {
            if (state.receiveBusName !== "empty") {
                msgBusUnsubscribe(state.receiveBusName, state.messageReceiver)
            }
            state.receiveBusName = busName
            if (state.receiveBusName !== "empty") {
                msgBusSubscribe(state.receiveBusName, state.messageReceiver)
            }
        }
function NT_nbx_setSendReceiveFromMessage(state, m) {
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
function NT_nbx_defaultMessageHandler(m) {}
function NT_nbx_receiveMessage(state, m) {
                    if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                        state.valueFloat = Math.min(Math.max(msg_readFloatToken(m, 0),state.minValue),state.maxValue)
                        const outMessage = msg_floats([state.valueFloat])
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "empty") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (msg_isBang(m)) {
                        
                        const outMessage = msg_floats([state.valueFloat])
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









        let F = 0
let FRAME = 0
let BLOCK_SIZE = 0
let SAMPLE_RATE = 0
let NULL_SIGNAL = 0
function SND_TO_NULL(m) {}
let EMPTY_MESSAGE = msg_create([])

        

        const N_n_0_1_state = {
                                minValue: -1e+37,
maxValue: 1e+37,
valueFloat: 220,
value: msg_create([]),
receiveBusName: "empty",
sendBusName: "empty",
messageReceiver: NT_nbx_defaultMessageHandler,
messageSender: NT_nbx_defaultMessageHandler,
                            }
const N_m_n_0_0_0_sig_state = {
                                currentValue: 0,
                            }
const N_n_0_0_state = {
                                phase: 0,
step: 0,
                            }
        
function N_n_0_1_rcvs_0(m) {
                            
                NT_nbx_receiveMessage(N_n_0_1_state, m)
                return
            
                            throw new Error('Node type "nbx", id "n_0_1", inlet "0", unsupported message : ' + msg_display(m))
                        }

function N_m_n_0_0_0__routemsg_rcvs_0(m) {
                            
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                N_m_n_0_0_0__routemsg_snds_0(m)
                return
            } else {
                SND_TO_NULL(m)
                return
            }
        
                            throw new Error('Node type "_routemsg", id "m_n_0_0_0__routemsg", inlet "0", unsupported message : ' + msg_display(m))
                        }
let N_m_n_0_0_0_sig_outs_0 = 0
function N_m_n_0_0_0_sig_rcvs_0(m) {
                            
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            N_m_n_0_0_0_sig_state.currentValue = msg_readFloatToken(m, 0)
            return
        }
    
                            throw new Error('Node type "sig~", id "m_n_0_0_0_sig", inlet "0", unsupported message : ' + msg_display(m))
                        }


let N_n_0_0_outs_0 = 0



function N_m_n_0_0_0__routemsg_snds_0(m) {
                        N_m_n_0_0_0_sig_rcvs_0(m)
COLD_0(m)
                    }

        function COLD_0(m) {
                    N_m_n_0_0_0_sig_outs_0 = N_m_n_0_0_0_sig_state.currentValue
                    NT_osc_t_setStep(N_n_0_0_state, N_m_n_0_0_0_sig_outs_0)
                }
        function IORCV_n_0_1_0(m) {
                    N_n_0_1_rcvs_0(m)
                }
        

        const exports = {
            metadata: {"libVersion":"0.1.0","audioSettings":{"bitDepth":64,"channelCount":{"in":2,"out":2},"sampleRate":0,"blockSize":0},"compilation":{"io":{"messageReceivers":{"n_0_1":{"portletIds":["0"],"metadata":{"group":"control:float","type":"nbx","label":"","position":[99,43],"initValue":220,"minValue":-1e+37,"maxValue":1e+37}}},"messageSenders":{}},"variableNamesIndex":{"io":{"messageReceivers":{"n_0_1":{"0":"IORCV_n_0_1_0"}},"messageSenders":{}}}}},
            initialize: (sampleRate, blockSize) => {
                exports.metadata.audioSettings.sampleRate = sampleRate
                exports.metadata.audioSettings.blockSize = blockSize
                SAMPLE_RATE = sampleRate
                BLOCK_SIZE = blockSize

                
                N_n_0_1_state.messageSender = N_m_n_0_0_0__routemsg_rcvs_0
                N_n_0_1_state.messageReceiver = function (m) {
                    NT_nbx_receiveMessage(N_n_0_1_state, m)
                }
                NT_nbx_setReceiveBusName(N_n_0_1_state, "empty")
    
                commons_waitFrame(0, () => N_m_n_0_0_0__routemsg_rcvs_0(msg_floats([N_n_0_1_state.valueFloat])))
            




            NT_osc_t_setStep(N_n_0_0_state, 0)
        

                COLD_0(EMPTY_MESSAGE)
            },
            dspLoop: (INPUT, OUTPUT) => {
                
        for (F = 0; F < BLOCK_SIZE; F++) {
            _commons_emitFrame(FRAME)
            
                N_n_0_0_outs_0 = Math.cos(N_n_0_0_state.phase)
                N_n_0_0_state.phase += N_n_0_0_state.step
            
OUTPUT[0][F] = N_n_0_0_outs_0
OUTPUT[1][F] = N_n_0_0_outs_0
            FRAME++
        }
    
            },
            io: {
                messageReceivers: {
                    n_0_1: {
                            "0": IORCV_n_0_1_0,
                        },
                },
                messageSenders: {
                    
                },
            }
        }

        
exports.commons_getArray = commons_getArray
exports.commons_setArray = commons_setArray
    