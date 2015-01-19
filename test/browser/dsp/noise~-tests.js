var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../../helpers')

describe.skip('dsp.noise~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should generate random values', function(done) {
      var patch = Pd.createPatch()
        , noise = patch.createObject('noise~')
        , dac = patch.createObject('dac~')

      noise.o(0).connect(dac.i(0))

      helpers.renderSamples(1, 10, function() {}, function(err, rendered) {
        assert.equal(_.uniq(rendered[0]).length, 10)
        done()
      })
    })

  })

})