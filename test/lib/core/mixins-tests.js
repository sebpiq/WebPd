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

    it('should set resolved immediately if reference exists', function() {
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

  describe('.UniqueIdsMixin', function() {

    var uniqueIds1 = _.extend({}, mixins.UniqueIdsMixin)
      , uniqueIds2 = _.extend({}, mixins.UniqueIdsMixin)

    it('should generate different ids everytime called', function() {
      var id11 = uniqueIds1._generateId()
        , id12 = uniqueIds1._generateId()
        , id21 = uniqueIds2._generateId()
      assert.ok(id11 != id12)
      assert.equal(id11, id21)
    })

  })

  describe('.EventReceiver', function() {

    it('should keep remove all listeners on destroy', function() {
      var eventReceiver = new mixins.EventReceiver
        , eventEmitter = new EventEmitter
        , received = []
        , handler = function() { received.push(arguments[0]) }

      eventReceiver.addListener(eventEmitter, 'bla', handler)
      eventReceiver.once(eventEmitter, 'blo', handler)
      eventReceiver.once(eventEmitter, 'blu', handler)
      
      eventEmitter.emit('bla', 1)
      eventEmitter.emit('blo', 2)
      eventEmitter.emit('bla', 3)
      eventEmitter.emit('blo', 4)
      eventReceiver.destroy()
      eventEmitter.emit('bla', 5)
      eventEmitter.emit('blu', 6)
    
      assert.deepEqual(received, [1, 2, 3])
    })

    it('should remove listener when removeListener called', function() {
      var eventReceiver = new mixins.EventReceiver
        , eventEmitter = new EventEmitter
        , received = []
        , handler = function() { received.push(arguments[0]) }
      
      eventReceiver.addListener(eventEmitter, 'bla', handler)
      eventReceiver.addListener(eventEmitter, 'blu', handler)
      eventReceiver.once(eventEmitter, 'blo', handler)

      eventEmitter.emit('bla', 1)
      eventReceiver.removeListener(eventEmitter, 'bla', handler)
      eventEmitter.emit('bla', 2)
      eventEmitter.emit('blu', 3)
      eventReceiver.removeListener(eventEmitter, 'blo', handler)
      eventEmitter.emit('blo', 4)

      assert.deepEqual(received, [1, 3])
    })

  })

})

