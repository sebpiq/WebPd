var assert = require('assert')
  , _ = require('underscore')
  , PdObject = require('../../../lib/core/PdObject')
  , interfaces = require('../../../lib/core/interfaces')
  , portlets = require('../../../lib/objects/portlets')
  , Patch = require('../../../lib/core/Patch')
  , Pd = require('../../../index')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')
  , TestingMailBox = require('./utils').TestingMailBox


describe('objects.portlets', function() {

  var DummyAudioNode = function() { this.calls = [] }
  _.extend(DummyAudioNode.prototype, { 
    connect: function(node, output, input) {
      this.calls.push(['connect', node, output, input])
    },
    disconnect: function(output) {
      this.calls.push(['disconnect', output])
    }
  })

  var DummyAudioContext = function() {}
  _.extend(DummyAudioContext.prototype, {
    createGain: function() {
      return new DummyAudioNode
    }
  })

  var DummyObject = PdObject.extend({
    type: 'dummy',
    init: function() { this.received = [] },
    message: function() {
      this.received.push(_.toArray(arguments))
    }
  })

  var DummySink = DummyObject.extend({
    inletDefs: [portlets.DspInlet, portlets.DspInlet],
    start: function() {
      this.i(0).setWaa(new DummyAudioNode())
      this.i(1).setWaa(new DummyAudioNode())
    }
  })

  var DummySource = DummyObject.extend({
    outletDefs: [portlets.DspOutlet, portlets.DspOutlet],
    start: function() {
      this.o(0).setWaa(new DummyAudioNode())
      this.o(1).setWaa(new DummyAudioNode())
    }
  })

  var dummyAudio = {
    start: function() {},
    stop: function() {},
    context: new DummyAudioContext()
  }

  beforeEach(function() {
    pdGlob.library['testingmailbox'] = TestingMailBox
    pdGlob.library['dummyobject'] = DummyObject
    pdGlob.library['dummysink'] = DummySink
    pdGlob.library['dummysource'] = DummySource
  })

  afterEach(function() { helpers.afterEach() })

  describe('.Inlet', function() {

    describe('.message', function() {

      it('should transmit messages to the object', function() {
        Pd.start(dummyAudio)
        var patch = Pd.createPatch()
          , dummyObj = patch.createObject('dummyobject')
          , inlet0 = new portlets.Inlet(dummyObj, 0)
          , inlet1 = new portlets.Inlet(dummyObj, 1)
          , inlet2 = new portlets.Inlet(dummyObj, 2)

        inlet0.message('a', 'b')
        assert.deepEqual(dummyObj.received, [[0, 'a', 'b']])
        inlet2.message('c')
        assert.deepEqual(dummyObj.received, [[0, 'a', 'b'], [2, 'c']])
      })
    })

  })

  describe('.DspInlet', function() {

    describe('hasDspSource', function() {

      it('should return `true` if the inlet has at least one dsp source', function() {
        var dspInlet = new portlets.DspInlet({}, 11)
          , outlet1 = new portlets.Outlet({}, 1)
          , outlet2 = new portlets.Outlet({}, 2)
          , dspOutlet1 = new portlets.DspOutlet({}, 22)
          , dspOutlet2 = new portlets.DspOutlet({}, 33)

        assert.equal(dspInlet.hasDspSource(), false)

        outlet1.connect(dspInlet)
        outlet2.connect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), false)

        dspOutlet1.connect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), true)

        dspOutlet2.connect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), true)

        outlet1.disconnect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), true)

        dspOutlet1.disconnect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), true)

        dspOutlet2.disconnect(dspInlet)
        assert.equal(dspInlet.hasDspSource(), false)
      })

    })

  })

  describe('.DspOutlet', function() {

    afterEach(function() {
      pdGlob.isStarted = false
    })

    describe('setWaa', function() {

      it('should maintain web audio connections', function() {
        Pd.start(dummyAudio)

        var patch = Pd.createPatch()
          , dummySink = patch.createObject('dummysink')
          , dummySource = patch.createObject('dummysource')
          , sourceNode1 = new DummyAudioNode()
          , sourceNode2 = new DummyAudioNode()
          , sourceNode1bis = new DummyAudioNode()
          , sinkNode1 = new DummyAudioNode()
          , sinkNode2 = new DummyAudioNode()
          , sinkNode1bis = new DummyAudioNode()
          , gainNode11, gainNode12, gainNode21
          , gainNode1bis1, gainNode1bis2, gainNode2bis1, gainNode1bis1bis

        // -------- 1
        // Set initial audio node for each portlet + connections
        dummySource.o(0).setWaa(sourceNode1, 11)
        dummySource.o(1).setWaa(sourceNode2, 22)
        dummySink.i(0).setWaa(sinkNode1, 33)
        dummySink.i(1).setWaa(sinkNode2, 44)

        dummySource.o(0).connect(dummySink.i(0))
        dummySource.o(0).connect(dummySink.i(1))
        dummySource.o(1).connect(dummySink.i(0))

        assert.equal(dummySource.o(0)._waaConnections.length, 2)
        assert.equal(dummySource.o(1)._waaConnections.length, 1)
        gainNode11 = dummySource.o(0)._waaConnections[0].gainNode
        gainNode12 = dummySource.o(0)._waaConnections[1].gainNode
        gainNode21 = dummySource.o(1)._waaConnections[0].gainNode

        // Check that each connection has been established as expected (i.e. through a gain node)
        assert.deepEqual(sourceNode1.calls, [
          [ 'connect', gainNode11, 11, undefined ],
          [ 'connect', gainNode12, 11, undefined ]
        ])
        assert.deepEqual(gainNode11.calls, [
          [ 'connect', sinkNode1, 0, 33 ]
        ])
        assert.deepEqual(gainNode12.calls, [
          [ 'connect', sinkNode2, 0, 44 ]
        ])
        assert.deepEqual(sourceNode2.calls, [
          [ 'connect', gainNode21, 22, undefined ]
        ])
        assert.deepEqual(gainNode21.calls, [
          [ 'connect', sinkNode1, 0, 33 ]
        ])

        // -------- 2
        // Now try to set a new audio node to one outlet
        dummySource.o(0).setWaa(sourceNode1bis, 55)
        assert.equal(dummySource.o(0)._waaConnections.length, 2)
        assert.equal(dummySource.o(1)._waaConnections.length, 1)
        gainNode1bis1 = dummySource.o(0)._waaConnections[0].gainNode
        gainNode1bis2 = dummySource.o(0)._waaConnections[1].gainNode
        assert.ok(gainNode1bis1 !== gainNode11)
        assert.ok(gainNode1bis2 !== gainNode12)

        // Check that old nodes were disconnected
        assert.deepEqual(gainNode11.calls, [
          [ 'connect', sinkNode1, 0, 33 ],
          [ 'disconnect', undefined ]
        ])
        assert.deepEqual(gainNode12.calls, [
          [ 'connect', sinkNode2, 0, 44 ],
          [ 'disconnect', undefined ]
        ])

        // Check that new node was connected
        assert.deepEqual(sourceNode1bis.calls, [
          [ 'connect', gainNode1bis1, 55, undefined ],
          [ 'connect', gainNode1bis2, 55, undefined ]
        ])
        assert.deepEqual(gainNode1bis1.calls, [
          [ 'connect', sinkNode1, 0, 33 ]
        ])
        assert.deepEqual(gainNode1bis2.calls, [
          [ 'connect', sinkNode2, 0, 44 ]
        ])

        // -------- 3
        // Now try to set a new audio node to one inlet
        dummySink.i(0).setWaa(sinkNode1bis, 66)
        assert.equal(dummySource.o(0)._waaConnections.length, 2)
        assert.equal(dummySource.o(1)._waaConnections.length, 1)
        gainNode1bis1bis = dummySource.o(0)._waaConnections[1].gainNode
        gainNode2bis1 = dummySource.o(1)._waaConnections[0].gainNode
        assert.ok(gainNode1bis1bis !== gainNode1bis1)
        assert.ok(gainNode2bis1 !== gainNode21)

        // Check that old nodes were disconnected
        assert.deepEqual(gainNode1bis1.calls, [
          [ 'connect', sinkNode1, 0, 33 ],
          [ 'disconnect', undefined ]
        ])
        assert.deepEqual(gainNode21.calls, [
          [ 'connect', sinkNode1, 0, 33 ],
          [ 'disconnect', undefined ]
        ])

        // Check that new connections were established
        assert.deepEqual(sourceNode1bis.calls, [
          [ 'connect', gainNode1bis1, 55, undefined ],
          [ 'connect', gainNode1bis2, 55, undefined ],
          [ 'connect', gainNode1bis1bis, 55, undefined ]
        ])
        assert.deepEqual(gainNode1bis1bis.calls, [
          [ 'connect', sinkNode1bis, 0, 66 ]
        ])
        assert.deepEqual(gainNode2bis1.calls, [
          [ 'connect', sinkNode1bis, 0, 66 ]
        ])

        // Check that no method was ever called on the sink nodes
        assert.deepEqual(sinkNode1.calls, [])
        assert.deepEqual(sinkNode2.calls, [])
        assert.deepEqual(sinkNode1bis.calls, [])
      })

      it('shouldnt crash if connecting before Pd is started', function() {
        var patch = Pd.createPatch()
          , dummySink = patch.createObject('dummysink')
          , dummySource = patch.createObject('dummysource')
        dummySource.o(0).connect(dummySink.i(0))

        Pd.start(dummyAudio)
      })

    })

    describe('connect', function() {

      it('should throw an error if connecting to something else than DspInlet', function() {
        var dspOutlet = new portlets.DspOutlet({}, 22)
          , inlet = new portlets.Inlet({}, 1)
        assert.throws(function() { dspOutlet.connect(inlet) })
      })

      it('should establish the waa connection', function() {
        var dspOutlet = new portlets.DspOutlet({}, 0)
          , dspInlet = new portlets.DspInlet({}, 0)
          , sourceNode = new DummyAudioNode()
          , sinkNode = new DummyAudioNode()
          , gainNode

        dspOutlet.setWaa(sourceNode, 11)
        dspInlet.setWaa(sinkNode, 22)

        pdGlob.isStarted = true
        dspOutlet.start()
        dspInlet.start()

        dspOutlet.connect(dspInlet)

        assert.equal(dspOutlet._waaConnections.length, 1)
        gainNode = dspOutlet._waaConnections[0].gainNode

        assert.deepEqual(sourceNode.calls, [[ 'connect', gainNode, 11, undefined ]])
        assert.deepEqual(gainNode.calls, [[ 'connect', sinkNode, 0, 22 ]])
        assert.deepEqual(sinkNode.calls, [])
      })

    })

    describe('disconnect', function() {

      it('should disconnect waa nodes', function() {
        var dspOutlet = new portlets.DspOutlet({}, 0)
          , dspInlet = new portlets.DspInlet({}, 0)
          , sourceNode = new DummyAudioNode()
          , sinkNode = new DummyAudioNode()
          , gainNode

        dspOutlet.setWaa(sourceNode, 11)
        dspInlet.setWaa(sinkNode, 22)

        pdGlob.isStarted = true
        dspOutlet.start()
        dspInlet.start()

        // Preparing the test
        dspOutlet.connect(dspInlet)
        gainNode = dspOutlet._waaConnections[0].gainNode
        sourceNode.calls = []
        gainNode.calls = []
        sinkNode.calls = []

        dspInlet.disconnect(dspOutlet)

        assert.deepEqual(sourceNode.calls, [])
        assert.deepEqual(gainNode.calls, [[ 'disconnect', undefined ]])
        assert.deepEqual(sinkNode.calls, [])
      })

    })

  })

  describe('[outlet] / [inlet] / [outlet~] / [inlet~]', function() {

    it('should update the patch\'s portlets', function() {
      var patch = Pd.createPatch()
      assert.deepEqual(patch.inlets, [])

      var outletObj = patch.createObject('outlet')
        , inletDspObj = patch.createObject('inlet~')
      assert.deepEqual(patch.inlets, [inletDspObj.inlets[0]])
      assert.deepEqual(patch.outlets, [outletObj.outlets[0]])
    })

    it('should transmit messages from outside / inside of the patch', function() {
      var patch = Pd.createPatch()
        , subpatch = patch.createObject('pd')
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = subpatch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
        , inlet = subpatch.createObject('inlet')
        , outlet = subpatch.createObject('outlet')

      mailbox1.o(0).connect(subpatch.i(0))
      mailbox2.i(0).connect(inlet.o(0))
      mailbox2.o(0).connect(outlet.i(0))
      mailbox3.i(0).connect(subpatch.o(0))
      
      mailbox1.i(0).message('bla', 111)
      assert.deepEqual(mailbox1.received, [['bla', 111]])
      assert.deepEqual(mailbox2.received, [['bla', 111]])
      assert.deepEqual(mailbox3.received, [['bla', 111]])

      mailbox2.i(0).message('blo', 222)
      assert.deepEqual(mailbox2.received, [['bla', 111], ['blo', 222]])
      assert.deepEqual(mailbox3.received, [['bla', 111], ['blo', 222]])
    }) 

  })


})
