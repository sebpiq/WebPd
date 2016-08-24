var assert = require('assert')
  , _ = require('underscore')
  , errors = require('../../../lib/core/errors')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/core/portlets')
  , PdObject = require('../../../lib/core/PdObject')
  , Pd = require('../../../index')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')


describe('core.Patch', function() {

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
      this.cleanCalled = 0
    },
    start: function() { this.startCalled++ },
    stop: function() { this.stopCalled++ },
    destroy: function() { this.cleanCalled++ },
    inletDefs: [ MyInlet, MyInlet ],
    outletDefs: [ MyOutlet, MyOutlet ]
  })

  var MyEndPoint = PdObject.extend({
    endPoint: true
  })

  beforeEach(function() {
    pdGlob.library['myobject'] = MyObject
    pdGlob.library['myendpoint'] = MyEndPoint
  })

  afterEach(function() { helpers.afterEach() })

  describe('.start', function() {

    it('should call objects and portlets start methods', function() {
      var patch = new Patch
        , obj1 = patch.createObject('myobject', [])
        , obj2 = patch.createObject('myobject', [])

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

    it('should emit started', function() {
      var patch = new Patch
        , obj1 = patch.createObject('myobject', [])
        , obj2 = patch.createObject('myobject', [])
        , started = 0

      patch.on('started', function() { started++ })
      patch.start()
      assert.equal(started, 1)
    })

    it('should start objects before portlets, inside subpatches and abstractions', function() {
      // The problem here is that with a subpatch, we also need to maintain 
      // the start order : objects first, portlets after
      // So calling subpatch.start() is not good as it will result in subpatch's portlets
      // being started before the parent patch's objects are all started.
      var called = []
      
      pdGlob.library['spy'] = PdObject.extend({
        outletDefs: [
          portlets.Outlet.extend({
            start: function() { called.push(this.obj.spyId + ':o(0).start') }
          })
        ],
        init: function(args) { this.spyId = args[0] },
        start: function() { called.push(this.spyId + ':start') }
      })

      Pd.registerAbstraction('spy-abs', '#N canvas 49 82 450 300 10;\n#X obj 143 70 spy 2;')

      var patch = new Patch()
        , subpatch = patch.createObject('pd')
        , spy1 = subpatch.createObject('spy', [1])
        , spyAbs = patch.createObject('spy-abs')
        , spy2 = spyAbs.objects[0]
        , spy3 = patch.createObject('spy', [3])

      patch.start()
      assert.equal(called.length, 6)
      assert.deepEqual(called, [
        '1:start', '2:start', '3:start',
        '1:o(0).start', '2:o(0).start', '3:o(0).start'
      ])
    })

    it('should not call start twice on patch portlets', function() {
      var OutletObj = PdObject.extend({
        outletDefs: [MyOutlet]
      })
      pdGlob.library['outlet'] = OutletObj

      var patch = new Patch
        , obj = patch.createObject('outlet')

      assert.equal(obj.o(0), patch.o(0))
      assert.equal(obj.o(0).startCalled, 0)
      patch.start()
      assert.equal(obj.o(0).startCalled, 1)
    })

    it('should call start on subpatches as well', function() {
      var patch = new Patch
        , subpatch = patch.createObject('pd')
        , subsubpatch = subpatch.createObject('pd')
        , subpatchStarted = 0, subsubpatchStarted = 0

      subpatch.on('started', function() { subpatchStarted++ })
      subsubpatch.on('started', function() { subsubpatchStarted++ }) 
      patch.start()
      assert.equal(subpatchStarted, 1)
      assert.equal(subsubpatchStarted, 1)
    })

  })
  
  describe('.stop', function() {

    it('should call all the objects and portlets stop methods', function() {
      var patch = new Patch
        , obj1 = patch.createObject('myobject', [])
        , obj2 = patch.createObject('myobject', [])
        , obj3 = patch.createObject('myobject', [])

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

    it('should emit stopped', function() {
      var patch = new Patch
        , obj1 = patch.createObject('myobject', [])
        , obj2 = patch.createObject('myobject', [])
        , stopped = false
      patch.start()
      patch.on('stopped', function() { stopped = true })
      patch.stop()
      assert.equal(stopped, true)
    })

  })

  describe('.destroy', function() {

    it('should call all the objects destroy methods', function() {
      var patch = new Patch
        , obj1 = patch.createObject('myobject', [])
        , obj2 = patch.createObject('myobject', [])
        , obj3 = patch.createObject('myobject', [])
      assert.equal(obj1.cleanCalled, 0)
      patch.destroy()
      assert.equal(obj1.cleanCalled, 1)
      assert.equal(obj2.cleanCalled, 1)
      assert.equal(obj3.cleanCalled, 1)
    })

  })

  describe('.createObject', function() {

    it('should assign the object an id and add it to the patch', function() {
      var patch = new Patch
        , obj = patch.createObject('myobject', [])

      assert.ok(obj.patch === patch)
      assert.ok(_.contains(patch.objects, obj))
      assert.ok(_.isNumber(obj.id))
    })

    it('should store endpoints', function() {
      var patch = new Patch
        , obj = patch.createObject('myobject', [])
        , endPointObj = patch.createObject('myendpoint', [])

      assert.ok(!_.contains(patch.endPoints, obj))
      assert.ok(_.contains(patch.endPoints, endPointObj))
    })

    it('should throw UnknownObjectError if object unknown', function() {
      var patch = new Patch
      assert.throws(
        function() { patch.createObject('Idonotexist', []) }, 
        errors.UnknownObjectError
      )
    })

  })

  describe('.resolveArgs', function() {

    it('should resolve $-args', function() {
      var patch = new Patch(null, null, [11, 'abc', 33])
      patch.patchId = 9999

      assert.deepEqual(
        patch.resolveArgs([123, '$0', '$1', 456, '$2', '$3']),
        [123, 9999, 11, 456, 'abc', 33]
      )
    })

    it('should resolve abbreviations', function() {
      var patch = new Patch
      assert.deepEqual(
        patch.resolveArgs(['bla', 'bang', 'b', 'f', 'l', 'a', 's']), 
        ['bla', 'bang', 'bang', 'float', 'list', 'anything', 'symbol']
      )
    })

    it('should resolve $0 in a subpatch as parent patch id', function() {
      var parentPatch = new Patch(null, null)
        , subpatch = new Patch(parentPatch, 0)
        , subsubpatch = new Patch(subpatch, 0)
      parentPatch.patchId = 98765
      assert.deepEqual(subpatch.resolveArgs(['$0']), [98765])
      assert.deepEqual(subsubpatch.resolveArgs(['$0']), [98765])
    })

    it('should resolve $0 in an abstraction as its own patch id and not the parent', function() {
      var parentPatch = new Patch(null, null)
        , abs1Instance, abs2Instance
      Pd.registerAbstraction('abs1', '#N canvas 49 82 450 300 10;\n#X obj 143 70 abs2;')
      Pd.registerAbstraction('abs2', '')
      abs1Instance = parentPatch.createObject('abs1')
      abs2Instance = abs1Instance.objects[0]
      parentPatch.patchId = 111
      abs1Instance.patchId = 222
      abs2Instance.patchId = 333
      assert.deepEqual(abs1Instance.resolveArgs(['$0']), [222])
      assert.deepEqual(abs2Instance.resolveArgs(['$0']), [333])
    })

  })

  describe('.getPatchRoot', function() {

    it('should return the root patch', function() {
      var parentPatch = new Patch(null, null)
        , subpatch = new Patch(parentPatch, 0)
        , subsubpatch = new Patch(subpatch, 0)

      assert.equal(parentPatch.getPatchRoot(), parentPatch)
      assert.equal(subpatch.getPatchRoot(), parentPatch)
      assert.equal(subsubpatch.getPatchRoot(), parentPatch)
    })

    it('should return the abstraction if it is the root patch', function() {
      var parentPatch = new Patch(null, null)
        , abs1Instance, abs1InstanceSubpatch
        , abs2Instance
      Pd.registerAbstraction('abs1', '#N canvas 49 82 450 300 10;\n#X obj 143 70 abs2;')
      Pd.registerAbstraction('abs2', '')
      abs1Instance = parentPatch.createObject('abs1')
      abs1InstanceSubpatch = new Patch(abs1Instance, 0)
      abs2Instance = abs1Instance.objects[0]

      assert.equal(abs1Instance.getPatchRoot(), abs1Instance)
      assert.equal(abs1InstanceSubpatch.getPatchRoot(), abs1Instance)
      assert.equal(abs2Instance.getPatchRoot(), abs2Instance)
    })

  })

})
