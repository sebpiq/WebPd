var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../helpers')
  , waa = require('../../lib/waa/interfaces')

describe('waa.Storage', function() {

  var storage = new waa.Storage()

  it('should load a known file', function(done) {
    storage.get('/test/browser/samples/steps-stereo-16b-44khz.wav', function(err, arrayBuffer) {
      assert.ok(!err)
      var length = arrayBuffer.byteLength
      // Test for an approx length (92610 frames + wav header)
      assert.ok(length > 92610 * 2 * 2 && length < 92610 * 2 * 2.1)
      done()
    })
  })

  it('should return an error if HTTP 440', function(done) {
    storage.get('/test/browser/samples/bla.wav', function(err, arrayBuffer) {
      assert.ok(err)
      done()
    })
  })

})