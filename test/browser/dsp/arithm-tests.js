var _ = require('underscore')
  , waatest = require('waatest')
  , async = require('async')
  , helpers = require('../../helpers')


var dspArithmTestSuite = function(name, operation) {

describe('dsp.' + name, function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should have value 0 by default', function(done) {
      var patch = Pd.createPatch()
        , arithm = patch.createObject(name)
        , dac = patch.createObject('dac~')

      arithm.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take initial value as argument', function(done) {
      var patch = Pd.createPatch()
        , arithm = patch.createObject(name, [1.1])
        , sig = patch.createObject('sig~', [3])
        , dac = patch.createObject('dac~')
        , expected = waatest.utils.makeBlock(2, 5, [operation(3, 1.1), 0])

      sig.o(0).connect(arithm.i(0))
      arithm.o(0).connect(dac.i(0))
      helpers.expectSamples(function() {}, expected, done)
    })

  })

  describe('i(1)', function() {

    it('should update value when sending a message', function(done) {
      var patch = Pd.createPatch()
        , arithm = patch.createObject(name, [1.1])
        , sig = patch.createObject('sig~', [3])
        , dac = patch.createObject('dac~')

      sig.o(0).connect(arithm.i(0))
      arithm.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        arithm.i(1).future(3 / Pd.getAudio().sampleRate * 1000, [2.2])
      }, [
        [operation(3, 1.1), operation(3, 1.1), operation(3, 1.1), operation(3, 2.2), operation(3, 2.2)],
        [0, 0, 0, 0, 0]
      ], done)
    })

    it('should take dsp input', function(done) {
      var patch = Pd.createPatch()
        , arithm = patch.createObject(name, [1.1])
        , sig1 = patch.createObject('sig~', [3])
        , sig2 = patch.createObject('sig~', [4.1])
        , dac = patch.createObject('dac~')
        , expected = waatest.utils.makeBlock(2, 5, [operation(3, 4.1), 0])

      sig1.o(0).connect(arithm.i(0))
      sig2.o(0).connect(arithm.i(1))
      arithm.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, expected, done)
    })

    it.skip('should return to fixed value when disconnecting all dsp', function(done) {
      var patch = Pd.createPatch()
        , arithm = patch.createObject(name, [1.1])
        , sig1 = patch.createObject('sig~', [3])
        , sig2 = patch.createObject('sig~', [4.1])
        , dac = patch.createObject('dac~')
        , expected = waatest.utils.makeBlock(2, 5, [operation(3, 1.1), 0])

      sig1.o(0).connect(arithm.i(0))
      sig2.o(0).connect(arithm.i(1))
      arithm.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, expected, done)
    })

  })


})

}

dspArithmTestSuite('*~', function(a, b) { return a * b })
dspArithmTestSuite('+~', function(a, b) { return a + b })
dspArithmTestSuite('-~', function(a, b) { return a - b })