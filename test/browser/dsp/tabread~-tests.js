var assert = require('assert')
  , _ = require('underscore')
  , helpers = require('../../helpers')
  , pdGlob = require('../../../lib/global')

describe('dsp.tabread~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should have value 0 by default', function(done) {
      var patch = Pd.createPatch()
        , array = patch.createObject('array', ['BLA', 4])
        , dac = patch.createObject('dac~')
        , tabread
      array.setData(new Float32Array([1, 2, 3, 4]))
      tabread = patch.createObject('tabread~', ['BLA'])

      helpers.expectSamples(function() {
        tabread.o(0).connect(dac.i(0))
      }, [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

    it('should be possible to create the tabread before the corresponding array', function() {
      var patch = Pd.createPatch()
        , dac = patch.createObject('dac~')
        , tabread = patch.createObject('tabread~', ['BLO'])
        , array

      array = patch.createObject('array', ['BLO', 4])
      array.setData(new Float32Array([1, 2, 3, 4]))
      assert.equal(tabread.array.resolved, array)
    })

  })

  it('should be possible to loadPatch when Pd is started', function() {
    Pd.start()
    var patch = Pd.loadPatch({
      nodes: [
        { id: 0, proto: 'table', args: ['BLA'] }, 
        { id: 1, proto: '*~' }, 
        { id: 2, proto: 'tabread~', args: ['BLA'] }
      ],
      connections: [{ source: { id: 1, port: 0 }, sink: { id: 2, port: 0 } }]
    })
    Pd.stop()
  })

  describe('destroy', function() {

    it('should clean properly', function() {
      var blaCalled = 0
        , changedCalled = 0
        , patch = Pd.createPatch()
        , array = patch.createObject('array', ['BLA', 4])
        , tabread = patch.createObject('tabread~', ['BLA'])
      tabread.array.on('bla', function() { blaCalled++ })
      tabread.array.emit('bla')
      assert.equal(blaCalled, 1)

      tabread.dataChanged = function() { changedCalled++ }
      tabread.array.resolved.emit('changed:data')
      assert.equal(changedCalled, 1)

      // It stop listening events on the reference
      tabread.destroy()
      tabread.array.emit('bla')
      assert.equal(blaCalled, 1)

      // It should unbind event handlers on the array
      tabread.array.resolved.emit('changed:data')
      assert.equal(changedCalled, 1)
    })

  })

  describe('i(0)', function() {

    it('should read at the position given by the first inlet', function(done) {
      var patch = Pd.createPatch()
        , array = patch.createObject('array', ['BLI', 10])
        , tabread
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')

      array.setData(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]))
      tabread = patch.createObject('tabread~', ['BLI'])

      helpers.expectSamples(function() {
        tabread.o(0).connect(dac.i(0))
        line.o(0).connect(tabread.i(0))
        line.i(0).message([0])
        line.i(0).message([5, 10 / Pd.getAudio().sampleRate * 1000])
      }, [
        [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })
    
    // This is not possible to test before we can suspend the OfflineAudioContext,
    // because here no matter when we modify the array.data, it is taken into account
    // by the actual node, only when audio is started.
    it.skip('should be possible to modify the array', function(done) {
      var patch = Pd.createPatch()
        , array = patch.createObject('array', ['BLU', 10])
        , tabread = tabread = patch.createObject('tabread~', ['BLU'])
        , line = patch.createObject('line~')
        , dac = patch.createObject('dac~')
      
      helpers.expectSamples(function() {
        tabread.o(0).connect(dac.i(0))
        line.o(0).connect(tabread.i(0))
        line.i(0).message([0])
        line.i(0).message([5, 10 / Pd.getAudio().sampleRate * 1000])
        array.setData(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]))
      }, [
        [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      ], done)
    })

  })

})