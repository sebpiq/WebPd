var assert = require('assert')
  , waatest = require('waatest')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../../helpers')
  , sampleRate = 44100


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
        , k = 2*Math.PI*440 / sampleRate
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
        , k = 2*Math.PI*660 / sampleRate
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

    it('should take an input signal to modulate the frequency', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~')
        , dac = patch.createObject('dac~')
        , line = patch.createObject('line~')
        , k = 2*Math.PI / sampleRate
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
        , k = 2*Math.PI*440 / sampleRate
        , k2 = 2*Math.PI*660 / sampleRate
        , phases = [0], acc = 0
      _.range(8).forEach(function(i) {
        acc += (i < 5) ? k : k2
        phases.push(acc)
      })

      osc.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        osc.i(0).future((1 / sampleRate) * 5 * 1000, [660])
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
        , k = 2*Math.PI*440 / sampleRate
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


describe('dsp.triangle~', function() {

  afterEach(function() { helpers.afterEach() })

  it('should generate a triangle', function(done) {
    var patch = Pd.createPatch()
      , triangle = patch.createObject('triangle~', [1])
      , dac = patch.createObject('dac~')
      , k = 4 / sampleRate
      , acc = 0
      , expected = []
    for (var i = 0; i < 10; i++) {
      expected.push(acc)
      acc += k
    }

    triangle.o(0).connect(dac.i(0))
    helpers.renderSamples(2, 10, function() {}, function(err, block) {
      assert.deepEqual(
        block[0].map(function(v) { return waatest.utils.round(v, 4) }),
        expected.map(function(v) { return waatest.utils.round(v, 4) })
      )
      assert.deepEqual(block[1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      done()
    })
  })

})


describe('dsp.square~', function() {
  
  afterEach(function() { helpers.afterEach() })

  it('should generate a square', function(done) {
    var patch = Pd.createPatch()
      , sampleCount = 20
      , square = patch.createObject('square~', [44100 / sampleCount])
      , dac = patch.createObject('dac~')
      , k = 4 / sampleRate
      , acc = 0
      , expected = []
    for (var i = 0; i < sampleCount; i++) {
      expected.push(acc)
      acc += k
    }
    square.o(0).connect(dac.i(0))
    helpers.renderSamples(2, sampleCount, function() {}, function(err, block) {
      assert.equal(waatest.utils.round(block[0][0], 2), 0)
      block[0].slice(1, sampleCount / 2).forEach(function(v) {
        assert.ok(waatest.utils.round(v, 2) > 0.7)
      })
      assert.equal(waatest.utils.round(block[0][sampleCount / 2], 2), 0)
      block[0].slice(sampleCount / 2 + 2).forEach(function(v) {
        assert.ok(waatest.utils.round(v, 2) < -0.7)
      })
      assert.deepEqual(block[1], _.range(sampleCount).map(function() { return 0 }))
      done()
    })
  })

})


describe.skip('dsp.phasor~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('contructor', function() {

    it.skip('should have frequency 0 by default', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~')
        , dac = patch.createObject('dac~')
      phasor.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take a frequency as first argument', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~', [440])
        , dac = patch.createObject('dac~')
        , k = 1 / (sampleRate / 440)
      phasor.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [0, k, 2*k, 3*k, 4*k, 5*k, 6*k, 7*k, 8*k, 9*k],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe('i(0)', function() {

    it('should update frequency when sending a message', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~', [440])
        , dac = patch.createObject('dac~')
        , k = 1 / (sampleRate / 660)
      phasor.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        phasor.i(0).message([660])
      }, [
        [0, k, 2*k, 3*k, 4*k, 5*k, 6*k, 7*k, 8*k, 9*k],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should take an input signal to modulate the frequency', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~')
        , dac = patch.createObject('dac~')
        , line = patch.createObject('line~')
        , k = 1 / sampleRate
        , phases = [0], acc = 0

      _.range(4410).forEach(function(i) {
        if (i % 128 === 0)
          k = 1 / (sampleRate / (i + 1))
        acc += k
        phases.push(acc % 1)
      })

      phasor.o(0).connect(dac.i(0))
      line.o(0).connect(phasor.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([10])
        line.i(0).message([10 + 44100, 10]) // [0, 1, 2, 3, ...]
      },
      [
        phases,
        _.range(4410).map(function() { return 0 })
      ], done)
    })

    it.skip('should schedule frequency change in the future', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / sampleRate
        , k2 = 2*Math.PI*660 / sampleRate
        , phases = [0], acc = 0
      _.range(8).forEach(function(i) {
        acc += (i < 5) ? k : k2
        phases.push(acc)
      })

      phasor.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        phasor.i(0).future((1 / sampleRate) * 5 * 1000, [660])
      }, [
        phases.map(cos),
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

  describe.skip('i(1)', function() {

    it('should reset the phase when receiving a message', function(done) {
      var patch = Pd.createPatch()
        , phasor = patch.createObject('phasor~', [440])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / sampleRate
      phasor.o(0).connect(dac.i(0))

      async.series([
        
        helpers.expectSamples.bind(helpers, function() {
          phasor.i(1).message([0.25])
        }, [
          [  
            cos(Math.PI / 2), cos(k*1 + Math.PI / 2), cos(k*2  + Math.PI / 2),
            cos(k*3  + Math.PI / 2), cos(k*4  + Math.PI / 2), cos(k*5  + Math.PI / 2),
            cos(k*6  + Math.PI / 2), cos(k*7  + Math.PI / 2), cos(k*8  + Math.PI / 2)
          ],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          phasor.i(1).message([0.5])
        }, [
          [  
            -1, cos(k*1 + Math.PI), cos(k*2  + Math.PI),
            cos(k*3  + Math.PI), cos(k*4  + Math.PI), cos(k*5  + Math.PI),
            cos(k*6  + Math.PI), cos(k*7  + Math.PI), cos(k*8  + Math.PI)
          ],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          phasor.i(1).message([0.75])
        }, [
          [0, sin(k*1), sin(k*2), sin(k*3), sin(k*4), sin(k*5), sin(k*6), sin(k*7), sin(k*8)],
          [0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]),

        helpers.expectSamples.bind(helpers, function() {
          phasor.i(1).message([1.25])
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