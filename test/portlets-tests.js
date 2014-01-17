var assert = require('assert')
  , _ = require('underscore')
  , utils = require('../lib/utils')
  , portlets = require('../lib/portlets')


describe('#portlets', function() {

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

  it('should work with subclassing', function() {
    var inlet = new portlets['inlet']()
    assert.ok(inlet instanceof portlets['inlet'])
    assert.ok(!(inlet instanceof portlets['inlet~']))
    inlet = new portlets['inlet~']()
    assert.ok(inlet instanceof portlets['inlet~'])
    assert.ok(!(inlet instanceof portlets['inlet']))
  })

  describe('#connect', function() {

    it('should connect/disconnect properly', function() {
      var sink = new portlets['inlet'](dummyObj, 0)
        , source = new portlets['outlet'](dummyObj, 1)

      sink.connect(source)
      assert.deepEqual(sink.connections, [source])
      sink.disconnect(source)
      assert.deepEqual(sink.connections, [])
    })

    it('should reject connection if portlet\'s objects are in different patches', function() {
      var sink = new portlets['inlet']({patch: 1}, 0)
        , source1 = new portlets['outlet']({patch: 2}, 1)
        , source2 = new portlets['outlet']({patch: 1}, 1)
      assert.throws(function() { sink.connect(source1) })
      assert.throws(function() { source1.connect(sink) })
      sink.connect(source2)
    })

    it('should emit the right events when connecting/disconnecting', function() {
      var sink = new portlets['inlet'](dummyObj, 0)
        , source = new portlets['outlet'](dummyObj, 1)
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

  describe('#outlet', function() {

    var received = []
      , MyInlet = portlets['inlet'].extend({
        message: function() {
          received.push(_.toArray(arguments).concat([this.id]))
        }
      })

    it('should transmit messages properly', function() {
      var outlet = new portlets['outlet'](dummyObj)
        , inlet0 = new MyInlet(dummyObj, 0)
        , inlet1 = new MyInlet(dummyObj, 1)
        , inlet2 = new MyInlet(dummyObj, 2)
      outlet.connect(inlet0)
      outlet.connect(inlet1)
      inlet2.connect(outlet)
      outlet.message('a', 'b')
      assert.deepEqual(received, [['a', 'b', 0], ['a', 'b', 1], ['a', 'b', 2]])
    })

  })

})
