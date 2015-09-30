var assert = require('assert')
  , _ = require('underscore')
  , PdObject = require('../../../lib/core/PdObject')
  , interfaces = require('../../../lib/core/interfaces')
  , portlets = require('../../../lib/waa/portlets')
  , Patch = require('../../../lib/core/Patch')
  , Pd = require('../../../index')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')
require('web-audio-test-api')
WebAudioTestAPI.unuse()

describe('portlets', function() {

  var DummyObject = PdObject.extend({
    type: 'dummy',
    init: function() { this.received = [] },
    message: function(args) {
      this.received.push(args)
    }
  })

  var getDummyNode = function() { return dummyAudio.context.createGain() }

  var DummySink = DummyObject.extend({
    inletDefs: [portlets.DspInlet, portlets.DspInlet],
    start: function() {
      this.i(0).setWaa(getDummyNode())
      this.i(1).setWaa(getDummyNode())
    }
  })

  var DummySource = DummyObject.extend({
    outletDefs: [portlets.DspOutlet, portlets.DspOutlet],
    start: function() {
      this.o(0).setWaa(getDummyNode())
      this.o(1).setWaa(getDummyNode())
    }
  })

  var dummyAudio

  beforeEach(function() {
    WebAudioTestAPI.use()
    dummyAudio = {
      start: function() {},
      stop: function() {},
      context: new AudioContext()
    }
    pdGlob.library['testingmailbox'] = helpers.TestingMailBox
    pdGlob.library['dummyobject'] = DummyObject
    pdGlob.library['dummysink'] = DummySink
    pdGlob.library['dummysource'] = DummySource
  })

  afterEach(function() {
    WebAudioTestAPI.unuse()
    helpers.afterEach() 
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

    var getWaaConnections = function(portlet) {
      return _.chain(portlet._waaConnections)
        .pairs().sortBy(function(p) { return p[0] }).pluck(1).value()
    }

    afterEach(function() {
      pdGlob.isStarted = false
    })

    describe('setWaa', function() {

      it('should maintain web audio connections if started', function() {
        Pd.start({audio: dummyAudio})

        var patch = Pd.createPatch()
          , dummySink = patch.createObject('dummysink')
          , dummySource = patch.createObject('dummysource')
          , sourceNode1 = getDummyNode()
          , sourceNode2 = getDummyNode()
          , sourceNode1bis = getDummyNode()
          , sinkNode1 = getDummyNode()
          , sinkNode2 = getDummyNode()
          , sinkNode1bis = getDummyNode()
          , waaConnections

        // -------- 1
        // Set initial audio node for each portlet + connections
        dummySource.o(0).setWaa(sourceNode1, 0)
        dummySource.o(1).setWaa(sourceNode2, 0)
        dummySink.i(0).setWaa(sinkNode1, 0)
        dummySink.i(1).setWaa(sinkNode2, 0)

        // Connections
        dummySource.o(0).connect(dummySink.i(0))
        dummySource.o(0).connect(dummySink.i(1))
        dummySource.o(1).connect(dummySink.i(0))

        waaConnections = getWaaConnections(dummySource.o(0))
        assert.equal(waaConnections.length, 2)
        assert.equal(waaConnections[0]._source, sourceNode1)
        assert.equal(waaConnections[0]._destination, sinkNode1)
        assert.equal(waaConnections[1]._source, sourceNode1)
        assert.equal(waaConnections[1]._destination, sinkNode2)

        waaConnections = getWaaConnections(dummySource.o(1))
        assert.equal(waaConnections.length, 1)
        assert.equal(waaConnections[0]._source, sourceNode2)
        assert.equal(waaConnections[0]._destination, sinkNode1)

        // -------- 2
        // Now try to set a new audio node to one outlet
        dummySource.o(0).setWaa(sourceNode1bis, 0)

        waaConnections = getWaaConnections(dummySource.o(0))
        assert.equal(waaConnections.length, 2)
        assert.equal(waaConnections[0]._source, sourceNode1bis)
        assert.equal(waaConnections[0]._destination, sinkNode1)
        assert.equal(waaConnections[1]._source, sourceNode1bis)
        assert.equal(waaConnections[1]._destination, sinkNode2)

        // -------- 3
        // Now try to set a new audio node to one inlet
        dummySink.i(0).setWaa(sinkNode1bis, 0)

        waaConnections = getWaaConnections(dummySource.o(0))
        assert.equal(waaConnections.length, 2)
        assert.equal(waaConnections[0]._source, sourceNode1bis)
        assert.equal(waaConnections[0]._destination, sinkNode1bis)
        assert.equal(waaConnections[1]._source, sourceNode1bis)
        assert.equal(waaConnections[1]._destination, sinkNode2)

        waaConnections = getWaaConnections(dummySource.o(1))
        assert.equal(waaConnections.length, 1)
        assert.equal(waaConnections[0]._source, sourceNode2)
        assert.equal(waaConnections[0]._destination, sinkNode1bis)
      })

      it('shouldnt crash if connecting before Pd is started', function() {
        var patch = Pd.createPatch()
          , dummySink = patch.createObject('dummysink')
          , dummySource = patch.createObject('dummysource')
        dummySource.o(0).connect(dummySink.i(0))

        Pd.start({audio: dummyAudio})
      })

    })

    describe('connect', function() {

      it('should throw an error if connecting to something else than DspInlet', function() {
        var dspOutlet = new portlets.DspOutlet({}, 22)
          , inlet = new portlets.Inlet({}, 1)
        assert.throws(function() { dspOutlet.connect(inlet) })
      })

      it('should establish the waa connection if connecting AFTER portlets started', function() {
        var dspOutlet = new portlets.DspOutlet({}, 0)
          , dspInlet = new portlets.DspInlet({}, 0)
          , sourceNode = getDummyNode()
          , sinkNode = getDummyNode()
          , waaConnections

        dspOutlet.setWaa(sourceNode, 0)
        dspInlet.setWaa(sinkNode, 0)

        Pd.start({ audio: dummyAudio })
        dspOutlet.start()
        dspInlet.start()

        assert.equal(getWaaConnections(dspOutlet).length, 0)
        dspOutlet.connect(dspInlet)
        waaConnections = getWaaConnections(dspOutlet)
        assert.equal(waaConnections.length, 1)
        assert.equal(waaConnections[0]._source, sourceNode)
        assert.equal(waaConnections[0]._destination, sinkNode)
      })

      it('should establish the waa connection if connecting BEFORE portlets started', function() {
        var dspOutlet = new portlets.DspOutlet({}, 0)
          , dspInlet = new portlets.DspInlet({}, 0)
          , sourceNode = getDummyNode()
          , sinkNode = getDummyNode()
          , waaConnections

        dspOutlet.setWaa(sourceNode, 0)
        dspInlet.setWaa(sinkNode, 0)
        dspOutlet.connect(dspInlet)
        assert.equal(getWaaConnections(dspOutlet).length, 0)

        Pd.start({ audio: dummyAudio })
        dspOutlet.start()
        dspInlet.start()

        waaConnections = getWaaConnections(dspOutlet)
        assert.equal(waaConnections.length, 1)
        assert.equal(waaConnections[0]._source, sourceNode)
        assert.equal(waaConnections[0]._destination, sinkNode)
      })

    })

    describe('disconnect', function() {

      it('should disconnect waa nodes', function() {
        var dspOutlet = new portlets.DspOutlet({}, 0)
          , dspInlet = new portlets.DspInlet({}, 0)
          , sourceNode = getDummyNode()
          , sinkNode = getDummyNode()
          , waaConnections

        dspOutlet.setWaa(sourceNode, 0)
        dspInlet.setWaa(sinkNode, 0)

        Pd.start({ audio: dummyAudio })
        dspOutlet.start()
        dspInlet.start()

        // Preparing the test
        dspOutlet.connect(dspInlet)
        assert.equal(getWaaConnections(dspOutlet).length, 1)

        dspInlet.disconnect(dspOutlet)
        assert.equal(getWaaConnections(dspOutlet).length, 0)
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
      
      mailbox1.i(0).message(['bla', 111])
      assert.deepEqual(mailbox1.received, [['bla', 111]])
      assert.deepEqual(mailbox2.received, [['bla', 111]])
      assert.deepEqual(mailbox3.received, [['bla', 111]])

      mailbox2.i(0).message(['blo', 222])
      assert.deepEqual(mailbox2.received, [['bla', 111], ['blo', 222]])
      assert.deepEqual(mailbox3.received, [['bla', 111], ['blo', 222]])
    }) 

  })


})
