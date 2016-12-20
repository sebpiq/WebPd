var _ = require('underscore')
  , fs = require('fs')
  , path = require('path')
  , assert = require('assert')
  , helpers = require('../helpers')
  , errors = require('../../lib/core/errors')
  , Patch = require('../../lib/core/Patch')
  , Abstraction = require('../../lib/core/Abstraction')
  , PdObject = require('../../lib/core/PdObject')
  , portlets = require('../../lib/core/portlets')
  , pdGlob = require('../../lib/global')
  , Pd = require('../../index')
  , helpers = require('../helpers')


describe('Pd', function() {

  afterEach(function() { helpers.afterEach() })

  describe('.start', function() {

    it('should start all the patches', function() {
      var createPatch = function() {
        var patch = Pd.createPatch()
        patch.startCalled = 0
        patch.start = function() { this.startCalled++ }
        return patch
      }

      var patch1 = createPatch()
        , patch2 = createPatch()
        , patch3 = createPatch()
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
      var createPatch = function() {
        var patch = Pd.createPatch()
        patch.stopCalled = 0
        patch.stop = function() { this.stopCalled++ }
        return patch
      }

      var patch1 = createPatch()
        , patch2 = createPatch()
        , patch3 = createPatch()
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

  describe('.createPatch', function() {

    it('should register the patch and give it an id', function() {
      var patch = Pd.createPatch()
      assert.ok(_.contains(_.values(pdGlob.patches), patch))
      assert.ok(_.isNumber(patch.patchId))
    })

  })

  describe('.destroyPatch', function() {

    it('should stop, clean the patch and forget it', function() {
      var patch = Pd.createPatch()
        , stopCalled = false
        , cleanCalled = false
      Pd.start()
      patch.stop = function() { stopCalled = true }
      patch.destroy = function() { cleanCalled = true }
      Pd.destroyPatch(patch)
      assert.ok(!_.contains(_.values(pdGlob.patches), patch))
      assert.equal(stopCalled, true)
      assert.equal(cleanCalled, true)
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

      var patch = Pd.createPatch()
        , obj = patch.createObject('dumbOsc', [220])
        , osc = obj.objects[0]
        , outlet = obj.objects[1]

      // Check instanciated abstraction
      assert.ok(obj instanceof Abstraction)
      assert.ok(_.isNumber(obj.patchId))
      assert.equal(obj.outlets.length, 1)
      assert.equal(obj.inlets.length, 0)
      assert.equal(obj.objects.length, 2)

      // Check objects and connections
      assert.equal(osc.o(0).connections.length, 1)
      assert.equal(outlet.i(0).connections.length, 1)
      assert.ok(osc.o(0).connections[0] === outlet.i(0))
    })

    it('should register abstractions as string as well', function() {
      var abstractionStr = fs.readFileSync(path.join(__dirname, 'patches/dumbOsc.pd')).toString()
      Pd.registerAbstraction('dumbOsc', abstractionStr)

      var patch = Pd.createPatch()
        , obj = patch.createObject('dumbOsc', [220])
        , osc = obj.objects[0]
        , outlet = obj.objects[1]

      // Check instanciated abstraction
      assert.ok(obj instanceof Abstraction)
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

      // Check patchData is present
      assert.equal(patch.patchData.nodes.length, 2)
      assert.equal(patch.patchData.connections.length, 1)
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

    it('should not call object.start twice if Pd already started', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/logStartPatch.pd').toString()
        , startCalled = 0
        , logStart = PdObject.extend({
          start: function() { startCalled++ }
        })
        , patch
      pdGlob.library.logStart = logStart
      Pd.start()
      patch = Pd.loadPatch(patchStr)
      assert.equal(patch.objects.length, 1)
      assert.equal(startCalled, 1)
    })

    it('should load patch with graph', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/graph.pd').toString()
        , patch = Pd.loadPatch(patchStr)
    })

    it('should throw PatchLoadError if unknown objects', function() {
      var patchData = {
          nodes: [ 
            {id: 0, proto: 'idontexist'}, 
            {id: 1, proto: 'outlet~'}, 
            {id: 2, proto: 'meneither'}
          ], connections: []
        }, thrown = false

      try { Pd.loadPatch(patchData) } catch(err) {
        thrown = true
        assert.ok(err instanceof errors.PatchLoadError)
        assert.equal(err.errorList.length, 2)
        assert.ok(err.errorList[0][1] instanceof errors.UnknownObjectError)
        assert.equal(err.errorList[0][1].objectType, 'idontexist')
        assert.ok(err.errorList[1][1] instanceof errors.UnknownObjectError)
        assert.equal(err.errorList[1][1].objectType, 'meneither')
      }
      assert.ok(thrown)
    })

    it('should throw PatchLoadError if unknown objects and connections between them', function() {
      var patchData = {
          nodes: [ 
            {id: 0, proto: 'idontexist'}, 
            {id: 1, proto: 'outlet~'}
          ], 
          connections: [
            { source: { id: 0, port: 0 }, sink: { id: 1, port: 0 } }
          ]
        }, thrown = false

      try { Pd.loadPatch(patchData) } catch(err) {
        thrown = true
        assert.ok(err instanceof errors.PatchLoadError)
        assert.equal(err.errorList.length, 2)
      }
      assert.ok(thrown)
    })

    it('should throw PatchLoadError if invalid connection', function() {
      var patchData = {
          nodes: [ 
            {id: 0, proto: 'osc~'}, 
            {id: 1, proto: 'outlet~'}
          ], 
          connections: [
            { source: { id: 0, port: 0 }, sink: { id: 1, port: 33 } }, // Invalid portlet
            { source: { id: 0, port: 0 }, sink: { id: 11, port: 0 } }  // Invalid object id
          ]
        }, thrown = false

      try { Pd.loadPatch(patchData) } catch(err) {
        thrown = true
        assert.ok(err instanceof errors.PatchLoadError)
        assert.equal(err.errorList.length, 2)
      }
      assert.ok(thrown)
    })

  })

  describe('.parsePatch', function() {

    it('should return patch data and reuse it in .loadPatch', function() {
      var patchStr = fs.readFileSync(__dirname + '/patches/simple.pd').toString()
        , patchData = Pd.parsePatch(patchStr)
      assert.equal(patchData.nodes.length, 2)
    })

  })

})
