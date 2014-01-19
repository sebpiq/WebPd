var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../../lib/core/utils')
  , portlets = require('../../lib/core/portlets')


describe('core.portlets', function() {

  describe('.extend', function() {

    it('should work with subclassing', function() {
      var MyInlet = portlets.Inlet.extend({})
      var inlet = new portlets.Inlet()
      assert.ok(inlet instanceof portlets.Inlet)
      assert.ok(!(inlet instanceof MyInlet))
      inlet = new MyInlet()
      assert.ok(inlet instanceof MyInlet)
      assert.ok(inlet instanceof portlets.Inlet)
    })

  })

  describe('.connect/disconnect', function() {

    var dummyObj = {patch: null}
      , received = []
      , setupInletHandlers = function(inlet) {
        inlet.on('connection', function(source) {
          received.push(['inlet connection', inlet.id, source.id])
        })

        inlet.on('disconnection', function(source) {
          received.push(['inlet disconnection', inlet.id, source.id])
        })
      }
      , setupOutletHandlers = function(outlet) {
        outlet.on('connection', function(sink) {
          received.push(['outlet connection', outlet.id, sink.id])
        })

        outlet.on('disconnection', function(sink) {
          received.push(['outlet disconnection', outlet.id, sink.id])
        })
      }

    beforeEach(function() {
      received = []
    })

    it('should connect/disconnect properly', function() {
      var sink = new portlets.Inlet(dummyObj, 0)
        , source = new portlets.Outlet(dummyObj, 1)

      sink.connect(source)
      assert.deepEqual(sink.connections, [source])
      sink.disconnect(source)
      assert.deepEqual(sink.connections, [])
    })

    it('should reject connection if portlet\'s objects are in different patches', function() {
      var sink = new portlets.Inlet({patch: 1}, 0)
        , source1 = new portlets.Outlet({patch: 2}, 1)
        , source2 = new portlets.Outlet({patch: 1}, 1)
      assert.throws(function() { sink.connect(source1) })
      assert.throws(function() { source1.connect(sink) })
      sink.connect(source2)
    })

    it('should emit the right events when connecting/disconnecting', function() {
      var sink = new portlets.Inlet(dummyObj, 0)
        , source = new portlets.Outlet(dummyObj, 1)
      setupInletHandlers(sink)
      setupOutletHandlers(source)

      sink.connect(source)
      assert.deepEqual(received, [
        ['outlet connection', 1, 0],
        ['inlet connection', 0, 1]
      ])

      source.disconnect(sink)
      assert.deepEqual(received, [
        ['outlet connection', 1, 0],
        ['inlet connection', 0, 1],
        ['inlet disconnection', 0, 1],
        ['outlet disconnection', 1, 0]
      ])
    })

  })

})
