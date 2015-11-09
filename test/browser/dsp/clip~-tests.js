var assert = require('assert')
  , _ = require('underscore')
  , waatest = require('waatest')
  , helpers = require('../../helpers')
  , sampleRate = 44100

describe('dsp.clip~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should have bounds [0, 0] by default', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~')
        , clip = patch.createObject('clip~')
        , dac = patch.createObject('dac~')

      helpers.expectSamples(function() {
        sig.o(0).connect(clip.i(0))
        clip.o(0).connect(dac.i(0))
      }, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take bounds as arguments', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~', [-5])
        , clip = patch.createObject('clip~', [-3, 40])
        , dac = patch.createObject('dac~')

      helpers.renderSamples(2, 10, function() {
        sig.o(0).connect(clip.i(0))
        clip.o(0).connect(dac.i(0))
        sig.i(0).future(2 * (1 / sampleRate) * 1000, [-2])
        sig.i(0).future(4 * (1 / sampleRate) * 1000, [35])
        sig.i(0).future(6 * (1 / sampleRate) * 1000, [40])
        sig.i(0).future(8 * (1 / sampleRate) * 1000, [42])
      }, function(err, block) {
        assert.deepEqual(
          block[0].map(function(v) { return waatest.utils.round(v, 2) }),
          [-3, -3, -2, -2, 35, 35, 40, 40, 40, 40]
        )
        assert.deepEqual(
          block[1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        )
        done()
      })
    })

  })

  describe('i(1), i(2)', function() {

    it('should update bounds when sending a message', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~', [-5])
        , clip = patch.createObject('clip~', [1, 20])
        , dac = patch.createObject('dac~')
      clip.i(1).message([-3])
      clip.i(2).message([40])
      helpers.renderSamples(2, 10, function() {
        sig.o(0).connect(clip.i(0))
        clip.o(0).connect(dac.i(0))
        sig.i(0).future(2 * (1 / sampleRate) * 1000, [-2])
        sig.i(0).future(4 * (1 / sampleRate) * 1000, [35])
        sig.i(0).future(6 * (1 / sampleRate) * 1000, [40])
        sig.i(0).future(8 * (1 / sampleRate) * 1000, [42])
      }, function(err, block) {
        assert.deepEqual(
          block[0].map(function(v) { return waatest.utils.round(v, 2) }),
          [-3, -3, -2, -2, 35, 35, 40, 40, 40, 40]
        )
        assert.deepEqual(
          block[1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        )
        done()
      })
    })
    
  })

})