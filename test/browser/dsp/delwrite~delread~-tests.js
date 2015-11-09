var assert = require('assert')
  , _ = require('underscore')
  , helpers = require('../../helpers')
  , pdGlob = require('../../../lib/global')

describe('dsp.delwrite~/delread~', function() {

  afterEach(function() { helpers.afterEach() })

  it('should have value 0 by default', function(done) {
    var patch = Pd.createPatch()
      , delread = patch.createObject('delread~', ['bla', 200])
      , dac = patch.createObject('dac~')

    helpers.expectSamples(function() {
      delread.o(0).connect(dac.i(0))
    }, [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

  it('should take sound from corresponding delwrite~', function(done) {
    var patch = Pd.createPatch()
      , delread = patch.createObject('delread~', ['bla', 0])
      , delwrite = patch.createObject('delwrite~', ['bla', 200])
      , line = patch.createObject('line~')
      , dac = patch.createObject('dac~')

    helpers.expectSamples(function() {
      line.o(0).connect(delwrite.i(0))
      line.i(0).message([0])
      line.i(0).message([10, 10/Pd.getAudio().sampleRate * 1000])
      delread.i(0).message([4/Pd.getAudio().sampleRate * 1000])
      delread.o(0).connect(dac.i(0))
      line.o(0).connect(dac.i(1))
    }, [
      [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    ], done)
  })

  it('should work if delwrite~ was started after', function(done) {
    var patch = Pd.createPatch()
      , delwrite = patch.createObject('delwrite~', ['bla', 200])
      , delread
      , line = patch.createObject('line~')
      , dac = patch.createObject('dac~')

    helpers.expectSamples(function() {
      delwrite.stop()
      delread = patch.createObject('delread~', ['bla', 0])
      delwrite.start()
      line.o(0).connect(delwrite.i(0))
      line.i(0).message([0])
      line.i(0).message([10, 10/Pd.getAudio().sampleRate * 1000])
      delread.i(0).message([4/Pd.getAudio().sampleRate * 1000])
      delread.o(0).connect(dac.i(0))
      line.o(0).connect(dac.i(1))
    }, [
      [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    ], done)
  })

  it('should be possible to have several delread~ for one delwrite~', function(done) {
    var patch = Pd.createPatch()
      , delread1 = patch.createObject('delread~', ['bla', 0])
      , delwrite = patch.createObject('delwrite~', ['bla', 200])
      , delread2 = patch.createObject('delread~', ['bla', 0])
      , line = patch.createObject('line~')
      , dac = patch.createObject('dac~')

    helpers.expectSamples(function() {
      line.o(0).connect(delwrite.i(0))
      line.i(0).message([0])
      line.i(0).message([10, 10/Pd.getAudio().sampleRate * 1000])
      delread1.i(0).message([4/Pd.getAudio().sampleRate * 1000])
      delread1.o(0).connect(dac.i(0))
      delread2.i(0).message([7/Pd.getAudio().sampleRate * 1000])
      delread2.o(0).connect(dac.i(1))
    }, [
      [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 2]
    ], done)
  })

  it('should take delay time as a signal to delread.i(0)', function(done) {
    var patch = Pd.createPatch()
      , delread = patch.createObject('delread~', ['bla', 0])
      , delwrite = patch.createObject('delwrite~', ['bla', 200])
      , line = patch.createObject('line~')
      , delayTimeLine = patch.createObject('line~')
      , dac = patch.createObject('dac~')

    helpers.expectSamples(function() {
      line.o(0).connect(delwrite.i(0))
      line.i(0).message([0])
      line.i(0).message([10, 10/Pd.getAudio().sampleRate * 1000])
      
      delayTimeLine.i(0).message([6/Pd.getAudio().sampleRate * 1000])
      delayTimeLine.i(0).message([0, 6/Pd.getAudio().sampleRate * 1000])
      
      delread.i(0).connect(delayTimeLine.o(0))
      delread.o(0).connect(dac.i(0))
      delayTimeLine.o(0).connect(dac.i(1))
    }, [
      [0, 0, 0, 0, 2, 4, 6, 7, 8, 9],
      [6/Pd.getAudio().sampleRate * 1000, 5/Pd.getAudio().sampleRate * 1000, 4/Pd.getAudio().sampleRate * 1000,
      3/Pd.getAudio().sampleRate * 1000, 2/Pd.getAudio().sampleRate * 1000, 1/Pd.getAudio().sampleRate * 1000,
      0, 0, 0, 0]
    ], done)
  })

  describe('delwrite~.destroy', function() {

    it('should clean properly event handlers', function() {
      var blaCalled = 0
        , unregistered = false
        , patch = Pd.createPatch()
        , delwrite = patch.createObject('delwrite~', ['BLA'])
      delwrite.on('bla', function() { blaCalled++ })
      delwrite.emit('bla')
      assert.equal(blaCalled, 1)

      // Once cleaned, the object should be unregistered
      pdGlob.emitter.on('namedObjects:unregistered:delwrite~', function(obj) {
        assert.equal(obj, delwrite)
        unregistered = true
      })
      delwrite.destroy()
      assert.equal(unregistered, true)

      // Destroy should unbind events 
      delwrite.emit('bla')
      assert.equal(blaCalled, 1)
    })

  })

  describe('delread~.destroy', function() {

    it('should clean properly event handlers', function() {
      var blaCalled = 0
        , patch = Pd.createPatch()
        , delread = patch.createObject('delread~', ['BLA'])
      delread._delWrite.on('bla', function() { blaCalled++ })
      delread._delWrite.emit('bla')
      assert.equal(blaCalled, 1)

      delread.destroy()

      // Destroy should unbind events 
      delread._delWrite.emit('bla')
      assert.equal(blaCalled, 1)
    })

  })


})