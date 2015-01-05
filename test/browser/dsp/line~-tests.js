var _ = require('underscore')
  , async = require('async')
  , helpers = require('../../helpers')

describe('dsp.line~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should have value 0 by default', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('i(0)', function() {

    it('should update value when sending a message', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([1345.99])
      }, [
        [1345.99, 1345.99, 1345.99, 1345.99, 1345.99, 1345.99, 1345.99, 1345.99, 1345.99, 1345.99],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should output a ramp when sending a list of numbers', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([1])
        line.i(0).message([442, 10])
      }, [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should schedule a value change in the future', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(5 * (1 / Pd.getSampleRate()), [1])
        line.i(0).future(5 * (1 / Pd.getSampleRate()), [442, 10])
      }, [
        [100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it.skip('should execute last line scheduled', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(2 * (1 / Pd.getSampleRate()), [1])
        line.i(0).future(2 * (1 / Pd.getSampleRate()), [442, 10])
        line.i(0).future(5 * (1 / Pd.getSampleRate()), [441* 2 + 1, 10])
      }, [
        [100, 100, 100, 100, 100, 1, 3, 5, 7, 9],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })


    it.skip('should interrupt a line properly', function(done) {
      // This cannot be tested without the ability to execute code
      // at a certain time while rendering the OfflineAudioContext
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(2 * (1 / Pd.getSampleRate()), [1])
        line.i(0).future(2 * (1 / Pd.getSampleRate()), [442, 10])
        line.i(0).future(5 * (1 / Pd.getSampleRate()), [441* 2 + 1, 10])
      }, [
        [100, 100, 1, 2, 3, 5, 7, 9, 11, 13],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })


})