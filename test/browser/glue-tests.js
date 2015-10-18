var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../helpers')
  , waa = require('../../lib/waa/interfaces')

describe('objects.glue', function() {

  beforeEach(function() {
    helpers.beforeEach()
    Pd.start()
  })
  afterEach(function() { helpers.afterEach() })

  describe('soundfiler', function() {

    it('should load a known file', function(done) {
      var patch = Pd.createPatch()
        , soundfiler = patch.createObject('soundfiler')
        , array1 = patch.createObject('array', ['ARR1', 10])
        , array2 = patch.createObject('array', ['ARR2', 10])
        , mailbox = patch.createObject('testingmailbox')
      soundfiler.o(0).connect(mailbox.i(0))

      mailbox.events.on('message', function() {
        assert.equal(array1.size, 92610)
        assert.equal(array2.size, 92610)
        assert.equal(Math.round(array1.data[0] * 10000) / 10000, -1)
        assert.deepEqual(mailbox.received, [[92610]])
        done()
      })

      soundfiler.i(0).message(['read', '-resize',
        '/test/browser/samples/steps-stereo-16b-44khz.wav', 'ARR1', 'ARR2'])
    })

  })

})