var assert = require('assert')
  , _ = require('underscore')
  , Patch = require('../../lib/core/Patch')
  , PdObject = require('../../lib/core/PdObject')
  , pdGlob = require('../../lib/global')

describe('core.patch', function() {

  describe('.Patch', function() {

    it('should register itself', function() {
      var patch = new Patch(1, 22, 333)
      assert.equal(patch.patch, null)
      assert.ok(_.contains(pdGlob.patches, patch))
      assert.ok(_.isNumber(patch.patchId))
      assert.deepEqual(patch.args, [1, 22, 333])
    })

    describe('.start', function() {

      var MyObject = PdObject.extend({
        start: function() { this.startCalled = true }
      })

      it('should call all the objects\' start methods', function() {
        var patch = new Patch
          , obj1 = new MyObject([], patch)
          , obj2 = new MyObject([], patch)
          , obj3 = new MyObject([], patch)
        assert.ok(!obj1.startCalled)
        patch.start()
        assert.ok(obj1.startCalled)
        assert.ok(obj2.startCalled)
        assert.ok(obj3.startCalled)
      })

    })

    describe('.stop', function() {

      var MyObject = PdObject.extend({
        stop: function() { this.stopCalled = true }
      })

      it('should call all the objects\' stop methods', function() {
        var patch = new Patch
          , obj1 = new MyObject([], patch)
          , obj2 = new MyObject([], patch)
          , obj3 = new MyObject([], patch)
        assert.ok(!obj1.stopCalled)
        patch.stop()
        assert.ok(obj1.stopCalled)
        assert.ok(obj2.stopCalled)
        assert.ok(obj3.stopCalled)
      })

    })

    describe('.register', function() {

      var MyEndPoint = PdObject.extend({
        endPoint: true
      })

      it('should assign the object an id and add it to the patch', function() {
        var patch = new Patch
          , obj = new PdObject([], patch)
        assert.ok(obj.patch === patch)
        assert.ok(_.contains(patch.objects, obj))
        assert.ok(_.isNumber(obj.id))
      })

      it('should store endpoints', function() {
        var patch = new Patch
          , obj = new PdObject([], patch)
          , endPointObj = new MyEndPoint([], patch)
        assert.ok(!_.contains(patch.endPoints, obj))
        assert.ok(_.contains(patch.endPoints, endPointObj))
      })

    })

  })

})
