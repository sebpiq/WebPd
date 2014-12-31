var _ = require('underscore')
  , assert = require('assert')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('../../../lib/core/utils')
  , pdGlob = require('../../../lib/global')


describe('core.utils', function() {

  describe('.chainExtend', function() {

    A = function() {}
    A.extend = utils.chainExtend
    A.prototype.blo = 456
    A.prototype.bli = 987
    A.prototype.func = function() { return 'blabla' }

    var B = A.extend({ 'bla': 113, 'bli': 654 })
      , C = B.extend({ 'bla': 112 })
      , b = new B()
      , c = new C()

    it('should work with instanceof', function() {
      assert.ok(b instanceof B)
      assert.ok(b instanceof A)
      assert.ok(c instanceof B)
      assert.ok(c instanceof A)
    })

    it('should work with inherited parameters', function() {
      assert.equal(b.bla, 113)
      assert.equal(b.bli, 654)
      assert.equal(b.blo, 456)

      assert.equal(c.bla, 112)
      assert.equal(c.bli, 654)
      assert.equal(c.blo, 456)
    })

  })

  describe('.UniqueIdsMixin', function() {

    var uniqueIds1 = _.extend({}, utils.UniqueIdsMixin)
      , uniqueIds2 = _.extend({}, utils.UniqueIdsMixin)

    it('should generate different ids everytime called', function() {
      var id11 = uniqueIds1._generateId()
        , id12 = uniqueIds1._generateId()
        , id21 = uniqueIds2._generateId()
      assert.ok(id11 != id12)
      assert.equal(id11, id21)
    })

  })

  describe('.NamedMixin', function() {

    beforeEach(function() { pdGlob.namedObjects = new utils.NamedObjectStore() })

    var MyNamedObject = function(name) { this.setName(name) }
    inherits(MyNamedObject, EventEmitter)
    _.extend(MyNamedObject.prototype, utils.NamedMixin, {
      type: 'namedObj'
    })

    var MyUNamedObject1 = function(name) { this.setName(name) }
    inherits(MyUNamedObject1, EventEmitter)
    _.extend(MyUNamedObject1.prototype, utils.NamedMixin, {
      nameIsUnique: true,
      init: function(name) { this.setName(name) },
      type: 'uniqNamedObj1'
    })

    var MyUNamedObject2 = function(name) { this.setName(name) }
    inherits(MyUNamedObject2, EventEmitter)
    _.extend(MyUNamedObject2.prototype, utils.NamedMixin, {
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

  })

  describe('.apply', function() {

    var A = function(arg1, arg2, arg3) {
      this.arg1 = arg1
      this.arg2 = arg2
      this.arg3 = arg3
    }

    A.prototype.b = function() {}

    it('should be able to create nodes', function() {
      var obj = utils.apply(A, [11, 22, 33])
      assert.ok(obj instanceof A)
      assert.equal(obj.arg1, 11)
      assert.equal(obj.arg2, 22)
      assert.equal(obj.arg3, 33)
      assert.equal(obj.b, A.prototype.b)
    })

    it('should work with `arguments`', function() {
      var f = function() { return utils.apply(A, arguments) }
        , obj = f(12, 23, 34)
      assert.ok(obj instanceof A)
      assert.equal(obj.arg1, 12)
      assert.equal(obj.arg2, 23)
      assert.equal(obj.arg3, 34)
      assert.equal(obj.b, A.prototype.b)
    })

  })

})

