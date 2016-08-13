var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , waatest = require('waatest')
  , WAAOffset = require('waaoffsetnode')
  , helpers = require('../helpers')

describe('portlets.outlet~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should send audio through a patch', function(done) {
      var patch = Pd.createPatch()
        , subpatch = patch.createObject('pd')
        , sig = subpatch.createObject('sig~', [11])
        , out = subpatch.createObject('outlet~')
        , dac = patch.createObject('dac~')

      sig.o(0).connect(out.i(0))
      subpatch.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [11, 11, 11, 11, 11],
        [0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('getOutNode', function() {

    var TestAudio = function(channelCount, context) {
      Object.defineProperty(this, 'time', {
        get: function() { return context.currentTime * 1000 }
      })
      this.context = context
      this.sampleRate = context.sampleRate
    }
    TestAudio.prototype.start = function() {}
    TestAudio.prototype.stop = function() {}

    it('should send audio to OutNode for connection with external Web Audio graph', function(done) {      
      var patch = Pd.createPatch()
        , subpatch = patch.createObject('pd')
        , sig = subpatch.createObject('sig~', [13])
        , out = subpatch.createObject('outlet~')
        , expected = [[13, 13, 13, 13, 13]]
      sig.o(0).connect(out.i(0))

      waatest.utils.expectSamples(function(context) {
        var channelCount = expected.length
          , audio = new TestAudio(channelCount, context)
        Pd.start({audio: audio})
        subpatch.o(0).getOutNode().connect(context.destination)
      }, expected, function(err) {
        Pd.stop()
        done(err)
      })
    })

    it('should update connection when setting new node on outlet', function(done) {      
      var patch = Pd.createPatch()
        , subpatch = patch.createObject('pd')
        , sig = subpatch.createObject('sig~', [13])
        , out = subpatch.createObject('outlet~')
        , expected = [[23, 23, 23, 23, 23]]
      sig.o(0).connect(out.i(0))

      waatest.utils.expectSamples(function(context) {
        var channelCount = expected.length
          , audio = new TestAudio(channelCount, context)
          , offsetNode = new WAAOffset(context)
        offsetNode.offset.value = 23
        Pd.start({audio: audio})
        // Connect the outNode, then set a new node on the outlet see if the new node
        // is connected to outNode.
        subpatch.o(0).getOutNode().connect(context.destination)
        subpatch.o(0).setWaa(offsetNode, 0)
      }, expected, function(err) {
        Pd.stop()
        done(err)
      })
    })

  })

})