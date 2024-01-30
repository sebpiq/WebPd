
        
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
const _commons_ENGINE_LOGGED_SKEDULER = sked_create(true)
const _commons_FRAME_SKEDULER = sked_create(false)
function _commons_emitEngineConfigure() {
            sked_emit(_commons_ENGINE_LOGGED_SKEDULER, 'configure')
        }
function _commons_emitFrame(frame) {
            sked_emit(_commons_FRAME_SKEDULER, frame.toString())
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
function commons_waitEngineConfigure(callback) {
            sked_wait(_commons_ENGINE_LOGGED_SKEDULER, 'configure', callback)
        }
function commons_waitFrame(frame, callback) {
            return sked_wait_future(_commons_FRAME_SKEDULER, frame.toString(), callback)
        }
function commons_cancelWaitFrame(id) {
            sked_cancel(_commons_FRAME_SKEDULER, id)
        }
        
function n_osc_t_setStep(state, freq) {
                    state.step = (2 * Math.PI / SAMPLE_RATE) * freq
                }
function n_osc_t_setPhase(state, phase) {
                    state.phase = phase % 1.0 * 2 * Math.PI
                }

function n_nbx_setReceiveBusName(state, busName) {
            if (state.receiveBusName !== "empty") {
                msgBusUnsubscribe(state.receiveBusName, state.messageReceiver)
            }
            state.receiveBusName = busName
            if (state.receiveBusName !== "empty") {
                msgBusSubscribe(state.receiveBusName, state.messageReceiver)
            }
        }
function n_nbx_setSendReceiveFromMessage(state, m) {
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'receive'
            ) {
                n_nbx_setReceiveBusName(state, msg_readStringToken(m, 1))
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
function n_nbx_defaultMessageHandler(m) {}
function n_nbx_receiveMessage(state, m) {
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
                    
                    } else if (n_nbx_setSendReceiveFromMessage(state, m) === true) {
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

        

        const n_0_1_STATE = {
                                minValue: -1e+37,
maxValue: 1e+37,
valueFloat: 220,
value: msg_create([]),
receiveBusName: "empty",
sendBusName: "empty",
messageReceiver: n_nbx_defaultMessageHandler,
messageSender: n_nbx_defaultMessageHandler
                            }
const m_n_0_0_0_sig_STATE = {
                                currentValue: 0
                            }
const n_0_0_STATE = {
                                phase: 0,
step: 0
                            }
        
function n_0_1_RCVS_0(m) {
                            
                n_nbx_receiveMessage(n_0_1_STATE, m)
                return
            
                            throw new Error('[nbx], id "n_0_1", inlet "0", unsupported message : ' + msg_display(m))
                        }

function m_n_0_0_0__routemsg_RCVS_0(m) {
                            
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                m_n_0_0_0__routemsg_SNDS_0(m)
                return
            } else {
                SND_TO_NULL(m)
                return
            }
        
                            throw new Error('[_routemsg], id "m_n_0_0_0__routemsg", inlet "0", unsupported message : ' + msg_display(m))
                        }
let m_n_0_0_0_sig_OUTS_0 = 0
function m_n_0_0_0_sig_RCVS_0(m) {
                            
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            m_n_0_0_0_sig_STATE.currentValue = msg_readFloatToken(m, 0)
            return
        }
    
                            throw new Error('[sig~], id "m_n_0_0_0_sig", inlet "0", unsupported message : ' + msg_display(m))
                        }
let n_0_0_OUTS_0 = 0




function m_n_0_0_0__routemsg_SNDS_0(m) {
                        m_n_0_0_0_sig_RCVS_0(m)
coldDsp_0(m)
                    }




        function coldDsp_0(m) {
                m_n_0_0_0_sig_OUTS_0 = m_n_0_0_0_sig_STATE.currentValue
                n_osc_t_setStep(n_0_0_STATE, m_n_0_0_0_sig_OUTS_0)
            }
        function ioRcv_n_0_1_0(m) {
                        n_0_1_RCVS_0(m)
                        
                    }
        

            
                commons_waitEngineConfigure(() => {
                    n_0_1_STATE.messageReceiver = function (m) {
                        n_nbx_receiveMessage(n_0_1_STATE, m)
                    }
                    n_0_1_STATE.messageSender = m_n_0_0_0__routemsg_RCVS_0
                    n_nbx_setReceiveBusName(n_0_1_STATE, "empty")
                })
    
                commons_waitFrame(0, () => m_n_0_0_0__routemsg_RCVS_0(msg_floats([n_0_1_STATE.valueFloat])))
            



            commons_waitEngineConfigure(() => {
                n_osc_t_setStep(n_0_0_STATE, 0)
            })
        

        coldDsp_0(EMPTY_MESSAGE)

        const exports = {
            metadata: {"libVersion":"0.1.0","audioSettings":{"bitDepth":64,"channelCount":{"in":2,"out":2},"sampleRate":0,"blockSize":0},"compilation":{"io":{"messageReceivers":{"n_0_1":{"portletIds":["0"],"metadata":{"group":"control:float","type":"nbx","label":"","position":[99,43],"initValue":220,"minValue":-1e+37,"maxValue":1e+37}}},"messageSenders":{}},"variableNamesIndex":{"io":{"messageReceivers":{"n_0_1":{"0":"ioRcv_n_0_1_0"}},"messageSenders":{}}}}},
            configure: (sampleRate, blockSize) => {
                exports.metadata.audioSettings.sampleRate = sampleRate
                exports.metadata.audioSettings.blockSize = blockSize
                SAMPLE_RATE = sampleRate
                BLOCK_SIZE = blockSize
                _commons_emitEngineConfigure()
            },
            loop: (INPUT, OUTPUT) => {
                
        for (F = 0; F < BLOCK_SIZE; F++) {
            _commons_emitFrame(FRAME)
            
            n_0_0_OUTS_0 = Math.cos(n_0_0_STATE.phase)
            n_0_0_STATE.phase += n_0_0_STATE.step
        
OUTPUT[0][F] = n_0_0_OUTS_0
OUTPUT[1][F] = n_0_0_OUTS_0
            FRAME++
        }
    
            },
            io: {
                messageReceivers: {
                    n_0_1: {
                            "0": ioRcv_n_0_1_0,
                        },
                },
                messageSenders: {
                    
                },
            }
        }

        

    