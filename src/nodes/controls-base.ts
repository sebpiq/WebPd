import { Code, NodeImplementation } from "@webpd/compiler-js/src/types"
import { NodeBuilder } from "../types"

export const EMPTY_BUS_NAME = 'empty'

export interface ControlsBaseNodeArguments {
    receiveBusName: string
    sendBusName: string
}

export const stateVariables = {
    value: 1,
    funcPrepareStoreValue: 1,
    funcPrepareStoreValueBang: 1,
    funcSetReceiveBusName: 1,
    sendBusName: 1,
    receiveBusName: 1,
    funcMessageReceiver: 1,
}

export const build: NodeBuilder<any>['build'] = () => ({
    inlets: {
        '0': { type: 'message', id: '0' },
    },
    outlets: {
        '0': { type: 'message', id: '0' },
    },
    // This is always true, because the object can receive 
    // messages through message bus
    isPushingMessages: true
})

export const declareControlSendReceive: NodeImplementation<any>['declare'] = ({ 
    node, 
    state, 
    node: { args }, 
    macros: { Var, Func }
}) => `
    let ${Var(state.receiveBusName, 'string')} = "${node.args.receiveBusName}"
    let ${Var(state.sendBusName, 'string')} = "${node.args.sendBusName}"

    function ${state.funcSetReceiveBusName} ${Func([
        Var('busName', 'string')
    ], 'void')} {
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusUnsubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
        ${state.receiveBusName} = busName
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusSubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetReceiveBusName}("${args.receiveBusName}")
    })
`

export const messageSetSendReceive: (
    context: Parameters<NodeImplementation<any>['declare']>[0]
) => Code = ({ globs, state }) => `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'receive'
    ) {
        ${state.funcSetReceiveBusName}(msg_readStringToken(${globs.m}, 1))
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'send'
    ) {
        ${state.sendBusName} = msg_readStringToken(${globs.m}, 1)
        return
    }
`