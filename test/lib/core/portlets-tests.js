var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../../../lib/core/utils')
  , portlets = require('../../../lib/core/portlets')
  , helpers = require('../../helpers')


describe('core.portlets', function() {

  afterEach(function() { helpers.afterEach() })

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

    it('should call the connection/disconnection methods', function() {
      var sink = new portlets.Inlet(dummyObj, 0)
        , source = new portlets.Outlet(dummyObj, 1)
        , received = []
      
      sink.connection = function(source) {
        received.push(['inlet connection', this.id, source.id])
      }

      sink.disconnection = function(source) {
        received.push(['inlet disconnection', this.id, source.id])
      }

      source.connection = function(sink) {
        received.push(['outlet connection', this.id, sink.id])
      }

      source.disconnection = function(sink) {
        received.push(['outlet disconnection', this.id, sink.id])
      }

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
