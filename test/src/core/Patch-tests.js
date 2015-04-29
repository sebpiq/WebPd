var assert = require('assert')
  , _ = require('underscore')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/core/portlets')
  , PdObject = require('../../../lib/core/PdObject')
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
        , started = false

      patch.on('started', function() { started = true })
      patch.start()
      assert.equal(started, true)
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
        init: function(args) {
          this.spyId = args[0]
        },
        start: function() {
          called.push(this.spyId + ':start')
        }
      })

      var patch = new Patch()
        , subpatch = patch.createObject('pd')
        , spy1 = subpatch.createObject('spy', [1])
        , spy2 = patch.createObject('spy', [2])

      patch.start()
      assert.equal(called.length, 4)
      assert.deepEqual(called, ['1:start', '2:start', '2:o(0).start', '1:o(0).start'])
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

  })

  describe('.resolveArgs', function() {

    it('should resolve $-args', function() {
      var patch = new Patch(null, null, [11, 'abc', 33])

      assert.deepEqual(
        patch.resolveArgs([123, '$0', '$1', 456, '$2', '$3']),
        [123, patch.patchId, 11, 456, 'abc', 33]
      )
    })

    it('should resolve abbreviations', function() {
      var patch = new Patch
      assert.deepEqual(
        patch.resolveArgs(['bla', 'bang', 'b', 'f', 'l', 'a', 's']), 
        ['bla', 'bang', 'bang', 'float', 'list', 'anything', 'symbol']
      )
    })

  })

})
