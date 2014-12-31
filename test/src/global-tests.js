var _ = require('underscore')
  , assert = require('assert')
  , Patch = require('../../lib/core/Patch')
  , pdGlob = require('../../lib/global')


describe('global', function() {
  
  describe('.register', function() {

    it('should register the patch and give it an id', function() {
      var patch = new Patch()
      assert.ok(_.contains(pdGlob.patches, patch))
      assert.ok(_.isNumber(patch.patchId))
    })

  })

})
