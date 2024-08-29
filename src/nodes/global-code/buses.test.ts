import { AnonFunc, ConstVar, Func, Sequence, Var, stdlib } from "@webpd/compiler"
import { runTestSuite } from "@webpd/compiler/src/test-helpers"
import { msgBuses, sigBuses } from "./buses"

describe('global-code.buses', () => {
    runTestSuite([
        {
            description: 'sigBuses > read > should read from given bus %s',
            testFunction: ({ globals: { sigBuses } }) => AnonFunc()`
                initTests()
                ${sigBuses.set}('BUS1', 123)
                ${sigBuses.set}('BUS2', 456)
                assert_floatsEqual(${sigBuses.read}('BUS1'), 123)
                assert_floatsEqual(${sigBuses.read}('BUS2'), 456)
            `
        },

        {
            description: 'sigBuses > reset > should reset given signal bus %s',
            testFunction: ({ globals: { sigBuses }}) => AnonFunc()`
                initTests()
                ${sigBuses.set}('BUS1', 123)
                ${sigBuses.set}('BUS2', 456)
                ${sigBuses.reset}('BUS1')
                assert_floatsEqual(${sigBuses.read}('BUS1'), 0)
                assert_floatsEqual(${sigBuses.read}('BUS2'), 456)
            `
        },

        {
            description: 'sigBuses > addAssign > should add to existing value on the bus %s',
            testFunction: ({ globals: { sigBuses }}) => AnonFunc()`
                initTests()
                ${sigBuses.set}('BUS1', 123)
                ${sigBuses.addAssign}('BUS1', 111)
                assert_floatsEqual(${sigBuses.read}('BUS1'), 234)
            `
        },

    ], [stdlib.core, sigBuses, {
        namespace: 'tests',
        code: (_, { sigBuses }) => Sequence([
            Func('initTests')`
                ${sigBuses.reset}('BUS1')
                ${sigBuses.reset}('BUS2')
            `
        ])
    }])

    runTestSuite([
        {
            description: 'msgBuses > publish - subscribe > should publish to given bus %s',
            testFunction: ({ globals: { msgBuses, msg }}) => AnonFunc()`
                initTests()
                ${ConstVar(msg.Message, `sent`, `${msg.strings}(['bla', 'hello'])`)}

                ${msgBuses.subscribe}('BUS1', (msg) => received = msg)
                ${msgBuses.publish}('BUS1', sent)
                assert_stringsEqual(${msg.readStringToken}(received, 0), 'bla')
                assert_stringsEqual(${msg.readStringToken}(received, 1), 'hello')
                assert_integersEqual(${msg.getLength}(received), 2)
            `
        },

        {
            description: 'msgBuses > unsubscribe > should cancel subscription to given bus %s',
            testFunction: ({ globals: { msgBuses, msg }}) => AnonFunc()`
                initTests()
                ${ConstVar(msg.Message, `sent`, `${msg.strings}(['bla', 'hello'])`)}
                ${ConstVar(msg.Handler, `msgHandler`, `(msg) => received = msg`)}

                ${msgBuses.subscribe}('BUS2', msgHandler)
                ${msgBuses.unsubscribe}('BUS2', msgHandler)
                ${msgBuses.publish}('BUS2', sent)
                assert_integersEqual(${msg.getLength}(received), 0)
            `
        },
    ], [stdlib.core, stdlib.msg, msgBuses, {
        namespace: 'tests',
        code: (_, { msg }) => Sequence([
            Var(msg.Message, `received`, `${msg.create}([])`),
            Func('initTests')`
                received = ${msg.create}([])
            `
        ])
    }])
})