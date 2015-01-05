var _ = require('underscore')
  , async = require('async')
  , helpers = require('../../helpers')

describe('dsp.osc~', function() {
  var cos = Math.cos
    , sin = Math.sin

  afterEach(function() { helpers.afterEach() })

  describe('contructor', function() {

    it('should have frequency 0 by default', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~')
        , dac = patch.createObject('dac~')
      osc.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take a frequency as first argument', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / Pd.getSampleRate()
      osc.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [1, cos(k*1), cos(k*2), cos(k*3), cos(k*4), cos(k*5), cos(k*6), cos(k*7), cos(k*8)],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('i(0)', function() {

    it('should update frequency when sending a message', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*660 / Pd.getSampleRate()
      osc.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        osc.i(0).message([660])
      }, [
        [1, cos(k*1), cos(k*2), cos(k*3), cos(k*4), cos(k*5), cos(k*6), cos(k*7), cos(k*8)],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take input from dsp if an object is connected', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , dac = patch.createObject('dac~')
        , line = patch.createObject('line~')
      osc.o(0).connect(dac.i(0))
      line.o(0).connect(osc.i(0))

      helpers.expectSamples(function() {},
      [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('take a input signal to modulate the frequency', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~')
        , dac = patch.createObject('dac~')
        , line = patch.createObject('line~')
        , k = 2*Math.PI / Pd.getSampleRate()
        , phases = [0], acc = 0
      _.range(9).forEach(function(i) {
        acc += (i * 10) * k
        phases.push(acc)
      })

      osc.o(0).connect(dac.i(0))
      line.o(0).connect(osc.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([4410, 10]) // [0, 10, 20, 30, ...]
      },
      [
        phases.map(cos),
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should schedule frequency change in the future', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / Pd.getSampleRate()
        , k2 = 2*Math.PI*660 / Pd.getSampleRate()
        , phases = [0], acc = 0
      _.range(8).forEach(function(i) {
        acc += (i < 5) ? k : k2
        phases.push(acc)
      })

      osc.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        osc.i(0).future((1 / Pd.getSampleRate()) * 5, [660])
      }, [
        phases.map(cos),
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('i(1)', function() {

    it('should reset the phase when receiving a message', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / Pd.getSampleRate()
      osc.o(0).connect(dac.i(0))

      async.series([
        
        helpers.expectSamples.bind(helpers, function() {
          osc.i(1).message([0.25])
        }, [
          [  
            cos(Math.PI / 2), cos(k*1 + Math.PI / 2), cos(k*2  + Math.PI / 2),
            cos(k*3  + Math.PI / 2), cos(k*4  + Math.PI / 2), cos(k*5  + Math.PI / 2),
            cos(k*6  + Math.PI / 2), cos(k*7  + Math.PI / 2), cos(k*8  + Math.PI / 2)
          ],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          osc.i(1).message([0.5])
        }, [
          [  
            -1, cos(k*1 + Math.PI), cos(k*2  + Math.PI),
            cos(k*3  + Math.PI), cos(k*4  + Math.PI), cos(k*5  + Math.PI),
            cos(k*6  + Math.PI), cos(k*7  + Math.PI), cos(k*8  + Math.PI)
          ],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          osc.i(1).message([0.75])
        }, [
          [0, sin(k*1), sin(k*2), sin(k*3), sin(k*4), sin(k*5), sin(k*6), sin(k*7), sin(k*8)],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          osc.i(1).message([1.25])
        }, [
          [  
            cos(Math.PI / 2), cos(k*1 + Math.PI / 2), cos(k*2  + Math.PI / 2),
            cos(k*3  + Math.PI / 2), cos(k*4  + Math.PI / 2), cos(k*5  + Math.PI / 2),
            cos(k*6  + Math.PI / 2), cos(k*7  + Math.PI / 2), cos(k*8  + Math.PI / 2)
          ],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ])

      ], done)
    })

    it.skip('should schedule phase change in the future', function(done) {
      // To work properly we need to be able to schedule a connect and a disconnect
      // in the future. That way we can setWaa the new oscillator at the right time.
    })

  })

})