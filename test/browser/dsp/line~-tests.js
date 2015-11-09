var assert = require('assert')
  , _ = require('underscore')
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

  describe('_queue', function() {

    it('_interpolate', function() {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , outlet = line.i(0)
      assert.equal(outlet._interpolate({t1: 0, v1: 0, t2: 1, v2: 1}, 0.5), 0.5) // x = y
      assert.equal(outlet._interpolate({t1: 0, v1: 1, t2: 1, v2: 1}, 0.5), 1)   // y = 1
      assert.equal(outlet._interpolate({t1: 0, v1: 1, t2: 1, v2: 3}, 0.5), 2)   // y = 1 + 2x
    })

    it('_refreshQueue', function() {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , outlet = line.i(0)
      
      // Nothing in queue, shouldnt change anything
      outlet._lastValue = 17
      assert.equal(outlet._refreshQueue())
      assert.deepEqual(outlet._queue, [])
      assert.deepEqual(outlet._lastValue, 17)

      // Normal refresh
      outlet._queue = [
        {t1: 0, v1: 0, t2: 1, v2: 1}, // x = y
        {t1: 1, v1: 3, t2: 2, v2: 5}  // y = 1 + 2x
      ]
      outlet._refreshQueue(0.2)
      assert.deepEqual(outlet._queue, [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 3, t2: 2, v2: 5}
      ])
      outlet._refreshQueue(1)
      assert.deepEqual(outlet._queue, [
        {t1: 1, v1: 3, t2: 2, v2: 5}
      ])
      assert.deepEqual(outlet._lastValue, 17) // shouldnt be affected

      // Empty queue
      outlet._refreshQueue(10)
      assert.deepEqual(outlet._queue, [])
      assert.deepEqual(outlet._lastValue, 5) // shouldnt be affected
    })

    it('_pushToQueue', function() {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , outlet = line.i(0)
      
      // A --- If previous lines on the queue
      // 1) interrupt previous
      outlet._queue = [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 2, v2: 5}
      ]
      assert.deepEqual(outlet._pushToQueue(1.5, 10, 0.5), [
        {t1: 1, v1: 1, t2: 1.5, v2: 3},
        {t1: 1.5, v1: 3, t2: 2, v2: 10}
      ])
      assert.deepEqual(outlet._queue, [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 1.5, v2: 3},
        {t1: 1.5, v1: 3, t2: 2, v2: 10}
      ])

      // 2) expand from previous
      outlet._queue = [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 2, v2: 5}
      ]
      assert.deepEqual(outlet._pushToQueue(3, 10, 0.5), [
        {t1: 2, v1: 5, t2: 3, v2: 5},
        {t1: 3, v1: 5, t2: 3.5, v2: 10},
      ])
      assert.deepEqual(outlet._queue, [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 2, v2: 5},
        {t1: 2, v1: 5, t2: 3, v2: 5},
        {t1: 3, v1: 5, t2: 3.5, v2: 10}
      ])

      // 3) fits exactly
      outlet._queue = [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 2, v2: 5}
      ]
      assert.deepEqual(outlet._pushToQueue(2, 10, 0.5), [
        {t1: 2, v1: 5, t2: 2.5, v2: 10}
      ])
      assert.deepEqual(outlet._queue, [
        {t1: 0, v1: 0, t2: 1, v2: 1},
        {t1: 1, v1: 1, t2: 2, v2: 5},
        {t1: 2, v1: 5, t2: 2.5, v2: 10}
      ])

      // B --- No value in queue yet
      // 2) expand from previous
      outlet._queue = []
      outlet._lastValue = 10
      assert.deepEqual(outlet._pushToQueue(3, 20, 0.5), [
        {t1: 0, v1: 10, t2: 3, v2: 10},
        {t1: 3, v1: 10, t2: 3.5, v2: 20}
      ])
      assert.deepEqual(outlet._queue, [
        {t1: 0, v1: 10, t2: 3, v2: 10},
        {t1: 3, v1: 10, t2: 3.5, v2: 20}
      ])
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
        line.i(0).future(5 * (1 / Pd.getAudio().sampleRate) * 1000, [1])
        line.i(0).future(5 * (1 / Pd.getAudio().sampleRate) * 1000, [442, 10])
      }, [
        [100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should only execute last change scheduled', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [10])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [442, 10])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [1])
      }, [
        [100, 100, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })


    it('should only execute last line scheduled', function(done) {
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [10])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [442, 10])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [1])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [441 * 2 + 1, 10])
      }, [
        [100, 100, 1, 3, 5, 7, 9, 11, 13, 15],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should interrupt a line properly', function(done) {
      // This cannot be tested without the ability to execute code
      // at a certain time while rendering the OfflineAudioContext
      var patch = Pd.createPatch()
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      line.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {
        line.i(0).message([100])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [1])
        line.i(0).future(2 * (1 / Pd.getAudio().sampleRate * 1000), [442, 10])
        line.i(0).future(4 * (1 / Pd.getAudio().sampleRate * 1000), [2 + 441 * 2 + 1, 10])
      }, [
        [100, 100, 1, 2, 3, 5, 7, 9, 11],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })


})