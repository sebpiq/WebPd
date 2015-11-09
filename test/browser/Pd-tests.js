var assert = require('assert')
  , pdGlob = require('../../lib/global')
  , Pd = require('../../index')
  , helpers = require('../helpers')

describe('Pd', function() {
  
  afterEach(function() { helpers.afterEach() })
  
  describe('start', function() {

    it('should create an Audio adapter and set the sampleRate', function() {
      Pd.start()
      assert.equal(pdGlob.audio.sampleRate, pdGlob.audio.context.sampleRate)
    })

  })

})