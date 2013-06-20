var _ = require('underscore')
  , fs = require('fs')
  , assert = require('assert')
  , Patch = require('../lib/Patch')
  , Pd = require('../index')
Pd.WAAContext = require('./index').WAAContext

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

  describe('loadPatch', function() {
    
    it('should load a simple patch properly', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/simple.pd').toString()
        , patch = Pd.loadPatch(patchStr)
      assert.equal(patch.objects.length, 2)

      var osc = patch.objects[0]
        , dac = patch.objects[1]

      // Check objects
      assert.equal(osc.type, 'osc~')
      assert.equal(osc.osc.frequency.value, 440)
      assert.equal(dac.type, 'dac~')

      // Check connections
      assert.equal(osc.o(0).sinks.length, 1)
      assert.ok(osc.o(0).sinks[0] === dac.i(0))
      assert.equal(dac.i(0).sources.length, 1)
      assert.equal(dac.i(1).sources.length, 0)
      assert.ok(dac.i(0).sources[0] === osc.o(0))
    })

    it('should load a patch with a subpatch properly', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/subpatch.pd').toString()
        , patch = Pd.loadPatch(patchStr)
      assert.equal(patch.objects.length, 3)

      var dac = patch.objects[0]
        , msg = patch.objects[1]
        , subpatch = patch.objects[2]

      // Check objects
      assert.equal(dac.type, 'dac~')
      assert.equal(msg.type, 'msg')
      assert.ok(subpatch instanceof Patch)

      // Check subpatch
      assert.equal(subpatch.objects.length, 3)
      var osc = subpatch.objects[0]
        , inlet = subpatch.objects[1]
        , outlet = subpatch.objects[2]
      assert.equal(osc.type, 'osc~')
      assert.equal(inlet.type, 'inlet')
      assert.equal(outlet.type, 'outlet~')
      assert.equal(osc.osc.frequency.value, 330)

      // Check connections in subpatch
      assert.equal(inlet.o(0).sinks.length, 1)
      assert.ok(inlet.o(0).sinks[0] === osc.i(0))
      assert.equal(osc.o(0).sinks.length, 1)
      assert.ok(osc.o(0).sinks[0] === outlet.i(0))

      // Check connections in root patch
      assert.equal(msg.o(0).sinks.length, 1)
      assert.ok(msg.o(0).sinks[0] === subpatch.i(0))
      assert.equal(subpatch.o(0).sinks.length, 2)
      assert.ok(subpatch.o(0).sinks[0] === dac.i(0))
      assert.ok(subpatch.o(0).sinks[1] === dac.i(1))
    })

  })

})
