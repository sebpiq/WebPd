var _ = require('underscore')
  , assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , Patch = require('../../lib/core/Patch')
  , mixins = require('../../lib/core/mixins')
  , pdGlob = require('../../lib/global')
  , helpers = require('../helpers')


describe('global', function() {
  
  afterEach(function() { helpers.afterEach() })

  describe('emitter', function() {

    it('should throw an error if trying to emit an unknown event', function() {
      assert.throws(function() {
        pdGlob.emitter.emit('unknown event')
      })
    })

  })

  describe('namedStore', function() {

    beforeEach(function() { pdGlob.namedObjects.reset() })

    var MyNamedObject = function(name) { this.setName(name) }
    _.extend(MyNamedObject.prototype, mixins.NamedMixin, EventEmitter.prototype, {
      type: 'namedObj'
    })

    var MyUNamedObject1 = function(name) { this.setName(name) }
    _.extend(MyUNamedObject1.prototype, mixins.NamedMixin, EventEmitter.prototype, {
      nameIsUnique: true,
      init: function(name) { this.setName(name) },
      type: 'uniqNamedObj1'
    })

    var MyUNamedObject2 = function(name) { this.setName(name) }
    _.extend(MyUNamedObject2.prototype, mixins.NamedMixin, EventEmitter.prototype, {
      nameIsUnique: true,
      init: function(name) { this.setName(name) },
      type: 'uniqNamedObj2'
    })

    it('should find the objects properly if name not unique', function() {
      var obj1A = new MyNamedObject('obj1')
        , obj1B = new MyNamedObject('obj1')
        , obj2 = new MyNamedObject('obj2')
        , query1 = pdGlob.namedObjects.get('namedObj', 'obj1')
        , query2 = pdGlob.namedObjects.get('namedObj', 'obj2')
        , query3 = pdGlob.namedObjects.get('namedObj', 'obj3')

      assert.equal(query1.length, 2)
      assert.equal(query1[0], obj1A)
      assert.equal(query1[1], obj1B)
      assert.equal(query2.length, 1)
      assert.equal(query2[0], obj2)
      assert.equal(query3.length, 0)
    })

    it('should emit an event when registering an object', function(done) {
      pdGlob.emitter.once('namedObjects:registered:namedObj', function(anObj) {
        assert.ok(anObj)
        assert.equal(anObj.name, 'bla')
        done()
      })
      var obj = new MyNamedObject('bla')
    })

    it('should update the register when changing name (not unique)', function() {
      var obj = new MyNamedObject('obj1')
        , query = pdGlob.namedObjects.get('namedObj', 'obj1')

      assert.equal(query.length, 1)
      assert.equal(query[0], obj)

      obj.setName('objONE')
      query = pdGlob.namedObjects.get('namedObj', 'obj1')
      assert.equal(query.length, 0)
      query = pdGlob.namedObjects.get('namedObj', 'objONE')
      assert.equal(query.length, 1)
      assert.equal(query[0], obj)
    })

    it('should find the objects properly if name is unique', function() {
      var obj1 = new MyUNamedObject1('obj1')
        , obj2 = new MyUNamedObject1('obj2')
        , obj3 = new MyUNamedObject2('obj1')
        , query1 = pdGlob.namedObjects.get('uniqNamedObj1', 'obj1')
        , query2 = pdGlob.namedObjects.get('uniqNamedObj1', 'obj2')
        , query3 = pdGlob.namedObjects.get('uniqNamedObj2', 'obj1')
        , query4 = pdGlob.namedObjects.get('uniqNamedObj1', 'obj3')

      assert.equal(query1.length, 1)
      assert.equal(query1[0], obj1)
      assert.equal(query2.length, 1)
      assert.equal(query2[0], obj2)
      assert.equal(query3.length, 1)
      assert.equal(query3[0], obj3)
      assert.equal(query4.length, 0)
    })

    it('should throw an error when registering two objects same type, same name (name unique)', function() {
      assert.throws(function() {
        var obj1 = new MyUNamedObject1('obj1')
          , obj2 = new MyUNamedObject1('obj1')
      })

      var obj1 = new MyUNamedObject1('obj3')
        , obj2 = new MyUNamedObject1('obj4')
      assert.throws(function() {
        obj2.setName('obj3')
      })
    })

    it('should update the register when changing name (name unique)', function() {
      var obj = new MyNamedObject('obj1')
        , query = pdGlob.namedObjects.get('namedObj', 'obj1')

      assert.equal(query.length, 1)
      assert.equal(query[0], obj)

      obj.setName('objONE')
      query = pdGlob.namedObjects.get('namedObj', 'obj1')
      assert.equal(query.length, 0)
      query = pdGlob.namedObjects.get('namedObj', 'objONE')
      assert.equal(query.length, 1)
      assert.equal(query[0], obj)
    })

    it('should unregister an object if it exists', function(done) {
      var obj = new MyNamedObject('bla')
        , query = pdGlob.namedObjects.get('namedObj', 'bla')
        , unregistered = null
      assert.deepEqual(query, [obj])

      pdGlob.emitter.once('namedObjects:unregistered:namedObj', function(anObj) {
        assert.equal(obj, anObj)
        assert.deepEqual(pdGlob.namedObjects.get('namedObj', 'bla'), [])
        done()
      })
      pdGlob.namedObjects.unregister(obj, 'namedObj', 'bla')
    })

    it('should do nothing if the object is already unregistered', function() {
      var obj1 = new MyNamedObject('blo')
        , obj2 = new MyNamedObject('blo')
        , query = pdGlob.namedObjects.get('namedObj', 'blo')
        , unregistered = null
      assert.equal(query.length, 2)
      pdGlob.namedObjects.unregister(obj1, 'namedObj', 'blo')
      assert.equal(pdGlob.namedObjects.get('namedObj', 'blo').length, 1)
      pdGlob.namedObjects.unregister(obj1, 'namedObj', 'blo')
      assert.equal(pdGlob.namedObjects.get('namedObj', 'blo').length, 1)
    })

  })

})
