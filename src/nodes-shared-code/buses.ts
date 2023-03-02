import { SharedCodeGenerator } from "@webpd/compiler-js/src/types";

// TODO : unit tests
export const signalBuses: SharedCodeGenerator = ({ macros: { Var, Func }}) => `
    const ${Var('SIGNAL_BUSES', 'Map<string, Float>')} = new Map()
    SIGNAL_BUSES.set('', 0)

    function addAssignSignalBus ${Func([
        Var('busName', 'string'), 
        Var('value', 'Float'),
    ], 'Float')} {
        const ${Var('newValue', 'Float')} = SIGNAL_BUSES.get(busName) + value
        SIGNAL_BUSES.set(
            busName,
            newValue,
        )
        return newValue
    }

    function resetSignalBus ${Func([
        Var('busName', 'string')
    ], 'void')} {
        SIGNAL_BUSES.set(busName, 0)
    }

    function readSignalBus ${Func([
        Var('busName', 'string')
    ], 'Float')} {
        return SIGNAL_BUSES.get(busName)
    }
`

// TODO : unit tests
export const messageBuses: SharedCodeGenerator = ({ macros: { Var, Func }}) => `
    const ${Var('MSG_BUSES', 'Map<string, Array<(m: Message) => void>>')} = new Map()

    function msgBusPublish ${Func([
        Var('busName', 'string'),
        Var('message', 'Message'),
    ], 'void')} {
        let ${Var('i', 'Int')} = 0
        const ${Var('callbacks', 'Array<(m: Message) => void>')} = MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []
        for (i = 0; i < callbacks.length; i++) {
            callbacks[i](message)
        }
    }

    function msgBusSubscribe ${Func([
        Var('busName', 'string'), 
        Var('callback', '(m: Message) => void'),
    ], 'void')} {
        if (!MSG_BUSES.has(busName)) {
            MSG_BUSES.set(busName, [])
        }
        MSG_BUSES.get(busName).push(callback)
    }

    function msgBusUnsubscribe ${Func([
        Var('busName', 'string'), 
        Var('callback', '(m: Message) => void'),
    ], 'void')} {
        if (!MSG_BUSES.has(busName)) {
            return
        }
        const ${Var('callbacks', 'Array<(m: Message) => void>')} = MSG_BUSES.get(busName)
        const ${Var('found', 'Int')} = callbacks.indexOf(callback) !== -1
        if (found !== -1) {
            callbacks.splice(found, 1)
        }
    }
`