var _ = require('underscore')
  , assert = require('assert')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('../../../lib/core/utils')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')


describe('core.utils', function() {

  afterEach(function() { helpers.afterEach() })

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

  describe('.getDollarResolver', function() {

    it('should resolve $-args', function() {
      var resolver = utils.getDollarResolver([1])
      assert.deepEqual(resolver([2, 'bla', 4]), [1])

      resolver = utils.getDollarResolver([1, '$1-bla-$3', 'bla', '$3'])
      assert.deepEqual(resolver([0, 'bli', 'bla', 4, 5]), [1, 'bli-bla-4', 'bla', 4])
      assert.deepEqual(resolver([0, 7, 'bloop', 'ploo', 5]), [1, '7-bla-ploo', 'bla', 'ploo'])
    })

    it('should throw an error if $-arg out of range', function() {
      var resolver = utils.getDollarResolver(['$5'])
      assert.throws(function() { resolver([1, 2]) })
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

})

