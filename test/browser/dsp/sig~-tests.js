var _ = require('underscore')
  , helpers = require('../../helpers')

describe('dsp.sig~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should have value 0 by default', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~')
        , dac = patch.createObject('dac~')

      helpers.expectSamples(function() {
        sig.o(0).connect(dac.i(0))
      }, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('i(0)', function() {

    it('should update value when sending a message', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~')
        , dac = patch.createObject('dac~')

      helpers.expectSamples(function() {
        sig.o(0).connect(dac.i(0))
        sig.i(0).message([-0.345])
      }, [
        [-0.345, -0.345, -0.345, -0.345, -0.345, -0.345, -0.345, -0.345, -0.345, -0.345],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should schedule a value change in the future', function(done) {
      var patch = Pd.createPatch()
        , sig = patch.createObject('sig~')
        , dac = patch.createObject('dac~')

      helpers.expectSamples(function() {
        sig.o(0).connect(dac.i(0))
        sig.i(0).message([11])
        sig.i(0).future(3 * (1 / Pd.getAudio().sampleRate) * 1000, [33])
      }, [
        [11, 11, 11, 33, 33, 33, 33, 33, 33, 33],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })
    
  })

})