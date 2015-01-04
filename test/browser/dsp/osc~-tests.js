var _ = require('underscore')
  , helpers = require('../../helpers')

describe('dsp.osc~', function() {
  var cos = Math.cos
    , sin = Math.sin

  afterEach(function() { helpers.afterEach() })

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

  it('should update frequency when sending a message to inlet 0', function(done) {
    var patch = Pd.createPatch()
      , osc = patch.createObject('osc~', [440])
      , dac = patch.createObject('dac~')
      , k = 2*Math.PI*660 / Pd.getSampleRate()
    osc.o(0).connect(dac.i(0))

    helpers.expectSamples(function() {
      osc.i(0).message(660)
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
      line.i(0).message(4410, 10) // [0, 10, 20, 30, ...]
    },
    [
      phases.map(cos),
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

})