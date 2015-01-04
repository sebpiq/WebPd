var assert = require('assert')
  , _ = require('underscore')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/core/portlets')
  , PdObject = require('../../../lib/core/PdObject')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')


describe('core.patch', function() {

  describe('.Patch', function() {

    var PortletMixin = {
      init: function() {
        this.startCalled = 0
        this.stopCalled = 0
        this.connectionCalled = 0
        this.disconnectionCalled = 0
      },
      start: function() { this.startCalled++ },
      stop: function() { this.stopCalled++ },
      connection: function() { this.connectionCalled++ },
      disconnection: function() { this.disconnectionCalled++ }
    }

    var MyInlet = portlets.Inlet.extend(PortletMixin)

    var MyOutlet = portlets.Outlet.extend(PortletMixin)

    var MyObject = PdObject.extend({
      init: function() {
        this.startCalled = 0
        this.stopCalled = 0
      },
      start: function() { this.startCalled++ },
      stop: function() { this.stopCalled++ },
      inletDefs: [ MyInlet, MyInlet ],
      outletDefs: [ MyOutlet, MyOutlet ]
    })

    afterEach(function() { helpers.afterEach() })

    it('should register itself', function() {
      var patch = new Patch(1, 22, 333)
      assert.equal(patch.patch, null)
      assert.ok(_.contains(pdGlob.patches, patch))
      assert.ok(_.isNumber(patch.patchId))
      assert.deepEqual(patch.args, [1, 22, 333])
    })

    describe('.start', function() {

      it('should call objects\' and portlets start methods', function() {
        var patch = new Patch
          , obj1 = new MyObject([], patch)
          , obj2 = new MyObject([], patch)

        assert.equal(obj1.startCalled, 0)
        assert.equal(obj1.o(0).startCalled, 0)

        patch.start()
        assert.equal(obj1.startCalled, 1)
        assert.equal(obj2.startCalled, 1)

        assert.equal(obj1.o(0).startCalled, 1)
        assert.equal(obj1.o(1).startCalled, 1)
        assert.equal(obj1.i(0).startCalled, 1)
        assert.equal(obj1.i(1).startCalled, 1)

        assert.equal(obj2.o(0).startCalled, 1)
        assert.equal(obj2.o(1).startCalled, 1)
        assert.equal(obj2.i(0).startCalled, 1)
        assert.equal(obj2.i(1).startCalled, 1)
      })

    })

    describe('.stop', function() {

      it('should call all the objects and portlets stop methods', function() {
        var patch = new Patch
          , obj1 = new MyObject([], patch)
          , obj2 = new MyObject([], patch)
          , obj3 = new MyObject([], patch)
        assert.equal(obj1.stopCalled, 0)
        assert.equal(obj1.o(0).stopCalled, 0)
        patch.stop()

        assert.equal(obj1.stopCalled, 1)
        assert.equal(obj2.stopCalled, 1)
        assert.equal(obj3.stopCalled, 1)

        assert.equal(obj1.o(0).stopCalled, 1)
        assert.equal(obj1.o(1).stopCalled, 1)
        assert.equal(obj1.i(0).stopCalled, 1)
        assert.equal(obj1.i(1).stopCalled, 1)

        assert.equal(obj2.o(0).stopCalled, 1)
        assert.equal(obj2.o(1).stopCalled, 1)
        assert.equal(obj2.i(0).stopCalled, 1)
        assert.equal(obj2.i(1).stopCalled, 1)
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
