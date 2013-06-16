var _ = require('underscore')
  , assert = require('assert')
  , Patch = require('../lib/Patch')
  , Pd = require('../index')

describe('Pd', function() {

  beforeEach(function() {
    Pd.patches = []
    Pd._isStarted = false
  })

  describe('start', function() {

    it('should start all the patches', function() {
      var MyPatch = function() { Patch.apply(this, arguments) }
      _.extend(MyPatch.prototype, Patch.prototype, {
        init: function() { this.startCalled = 0 },
        start: function() { this.startCalled++ }
      })

      var patch1 = new MyPatch()
        , patch2 = new MyPatch()
        , patch3 = new MyPatch()
      assert.ok(!Pd.isStarted())
      assert.equal(patch1.startCalled, 0)
      Pd.start()
      Pd.start()
      assert.equal(patch1.startCalled, 1)
      assert.equal(patch2.startCalled, 1)
      assert.equal(patch3.startCalled, 1)
    })

  })

  describe('stop', function() {

    it('should stop all the patches', function() {
      var MyPatch = function() { Patch.apply(this, arguments) }
      _.extend(MyPatch.prototype, Patch.prototype, {
        init: function() { this.stopCalled = 0 },
        stop: function() { this.stopCalled++ }
      })
      var patch1 = new MyPatch()
        , patch2 = new MyPatch()
        , patch3 = new MyPatch()
      assert.ok(!Pd.isStarted())
      assert.equal(patch1.stopCalled, 0)
      Pd.stop()
      assert.equal(patch1.stopCalled, 0)
      Pd.start()
      assert.equal(patch1.stopCalled, 0)
      Pd.stop()
      assert.equal(patch1.stopCalled, 1)
      assert.equal(patch2.stopCalled, 1)
      assert.equal(patch3.stopCalled, 1)
    })

  })

  describe('register', function() {

    it('should register the patch and give it an id', function() {
      var patch = new Patch()
      assert.ok(_.contains(Pd.patches, patch))
      assert.ok(_.isNumber(patch.patchId))
    })

  })

})
