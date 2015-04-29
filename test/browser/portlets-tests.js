var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../helpers')

describe('portlets.outlet~', function() {

  afterEach(function() { helpers.afterEach() })

  describe('constructor', function() {

    it('should send audio through a patch', function(done) {
      var patch = Pd.createPatch()
        , subpatch = patch.createObject('pd')
        , sig = subpatch.createObject('sig~', [11])
        , out = subpatch.createObject('outlet~')
        , dac = patch.createObject('dac~')

      sig.o(0).connect(out.i(0))
      subpatch.o(0).connect(dac.i(0))

      helpers.expectSamples(function() {}, [
        [11, 11, 11, 11, 11],
        [0, 0, 0, 0, 0]
      ], done)
    })

  })

})