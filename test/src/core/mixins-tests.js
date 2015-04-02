var assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , _ = require('underscore')
  , mixins = require('../../../lib/core/mixins')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')


describe('core.mixins', function() {

  afterEach(function() { helpers.afterEach() })

  describe('Reference', function() {

    var MyObject = function() {}
    _.extend(MyObject.prototype, EventEmitter.prototype, mixins.NamedMixin, {
      type: 'myobject'
    })

    it('should set resolved immediately of reference exists', function() {
      var obj = new MyObject()
        , reference = new mixins.Reference('myobject')
        , changed = []
      reference.on('changed', function(nw, old) { changed.push([nw, old]) })

      obj.setName('bla222')
      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [])

      reference.set('bla222')
      assert.equal(reference.resolved, obj)
      assert.equal(reference._onNewObject, null)
      assert.deepEqual(changed, [[obj, null]])
    })

    it('should wait for the object to be registered if reference doesnt exist', function() {
      var obj = new MyObject()
        , reference = new mixins.Reference('myobject')
        , changed = []
      reference.on('changed', function(nw, old) { changed.push([nw, old]) })

      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [])

      reference.set('bla222')
      assert.equal(reference.resolved, null)
      assert.ok(reference._onNewObject)
      assert.deepEqual(changed, [[null, null]])

      obj.setName('bla222')
      assert.equal(reference.resolved, obj)
      assert.equal(reference._onNewObject, null)
      assert.deepEqual(changed, [[null, null], [obj, null]])
    })

    it('should stop waiting for an object if the reference is changed', function() {
      var obj1 = new MyObject()
        , obj2 = new MyObject()
        , reference = new mixins.Reference('myobject')
        , changed = []
      reference.on('changed', function(nw, old) { changed.push([nw, old]) })

      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [])

      reference.set('obj1')
      assert.ok(reference._onNewObject)
      reference.set('obj2')
      assert.ok(reference._onNewObject)

      obj1.setName('obj1')
      assert.equal(reference.resolved, null)
      assert.ok(reference._onNewObject)
      assert.deepEqual(changed, [[null, null], [null, null]])

      obj2.setName('obj2')
      assert.equal(reference.resolved, obj2)
    })

    it('should forget the resolved object if that object is changing name', function() {
      var obj = new MyObject()
        , reference = new mixins.Reference('myobject')
        , changed = []
      reference.on('changed', function(nw, old) { changed.push([nw, old]) })

      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [])

      obj.setName('blabla')
      reference.set('blabla')
      assert.equal(reference.resolved, obj)
      assert.deepEqual(changed, [[obj, null]])

      obj.setName('bloblo')
      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [[obj, null], [null, obj]])
    })

    it('should detach previous resolved events if setting a new reference', function() {
      var obj1 = new MyObject()
        , obj2 = new MyObject()
        , reference = new mixins.Reference('myobject')
        , changed = []
      reference.on('changed', function(nw, old) { changed.push([nw, old]) })

      assert.equal(reference.resolved, null)
      assert.deepEqual(changed, [])

      obj1.setName('obj1')
      obj2.setName('obj2')

      reference.set('obj1')
      assert.equal(reference.resolved, obj1)
      assert.deepEqual(changed, [[obj1, null]])
      
      reference.set('obj2')
      assert.equal(reference.resolved, obj2)
      assert.deepEqual(changed, [[obj1, null], [obj2, obj1]])

      obj1.setName('blabla')
      assert.equal(reference.resolved, obj2) // shouldnt change
    })

  })

})

