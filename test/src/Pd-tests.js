var _ = require('underscore')
  , fs = require('fs')
  , assert = require('assert')
  , Patch = require('../lib/core/Patch')
  , pdGlob = require('../lib/global')
  , Pd = require('../index')

describe('Pd', function() {

  beforeEach(function() {
    pdGlob.patches = []
    pdGlob.isStarted = false
  })

  describe('.start', function() {

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

  describe('.stop', function() {

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

  describe('.register', function() {

    it('should register the patch and give it an id', function() {
      var patch = new Patch()
      assert.ok(_.contains(pdGlob.patches, patch))
      assert.ok(_.isNumber(patch.patchId))
    })

  })

  describe('.registerAbstraction', function() {

    it('should register abstractions rightly', function() {
      var abstraction = {
        nodes: [
          {id: 0, proto: 'osc~', args: ['$1']},
          {id: 1, proto: 'outlet~'}
        ],
        connections: [
          {source: {id: 0, port: 0}, sink: {id: 1, port: 0}}
        ]
      }
      Pd.registerAbstraction('dumbOsc', abstraction)

      var obj = new Pd.lib['dumbOsc'](220)
        , osc = obj.objects[0]
        , outlet = obj.objects[1]

      // Check instanciated abstraction
      assert.ok(obj instanceof Patch)
      assert.equal(obj.outlets.length, 1)
      assert.equal(obj.inlets.length, 0)
      assert.equal(obj.objects.length, 2)
      
      // Check objects and connections
      assert.equal(osc.o(0).connections.length, 1)
      assert.equal(outlet.i(0).connections.length, 1)
      assert.ok(osc.o(0).connections[0] === outlet.i(0))
    })

  })

  describe('.loadPatch', function() {
    
    it('should load a simple patch properly', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/simple.pd').toString()
        , patch = Pd.loadPatch(patchStr)
      assert.equal(patch.objects.length, 2)

      var osc = patch.objects[0]
        , dac = patch.objects[1]

      // Check objects
      assert.equal(osc.type, 'osc~')
      assert.equal(osc.frequency, 440)
      assert.equal(dac.type, 'dac~')

      // Check connections
      assert.equal(osc.o(0).connections.length, 1)
      assert.ok(osc.o(0).connections[0] === dac.i(0))
      assert.equal(dac.i(0).connections.length, 1)
      assert.equal(dac.i(1).connections.length, 0)
      assert.ok(dac.i(0).connections[0] === osc.o(0))
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
      assert.equal(osc.frequency, 330)

      // Check connections in subpatch
      assert.equal(inlet.o(0).connections.length, 1)
      assert.ok(inlet.o(0).connections[0] === osc.i(0))
      assert.equal(osc.o(0).connections.length, 1)
      assert.ok(osc.o(0).connections[0] === outlet.i(0))

      // Check connections in root patch
      assert.equal(msg.o(0).connections.length, 1)
      assert.ok(msg.o(0).connections[0] === subpatch.i(0))
      assert.equal(subpatch.o(0).connections.length, 2)
      assert.ok(subpatch.o(0).connections[0] === dac.i(0))
      assert.ok(subpatch.o(0).connections[1] === dac.i(1))
    })

  })

})
