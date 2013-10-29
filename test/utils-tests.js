var _ = require('underscore')
  , Pd = require('../index')
  , assert = require('assert')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('../lib/utils')
  , clock = utils.clock


describe('#utils', function() {

  describe('#chainExtend', function() {

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

  describe('#UniqueIdsMixin', function() {

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

  describe('#NamedMixin', function() {

    beforeEach(function() { Pd._namedObjects = {} })

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

    describe('#non-unique named objects', function() {

      it('should find the objects properly', function() {
        var obj1A = new MyNamedObject('obj1')
          , obj1B = new MyNamedObject('obj1')
          , obj2 = new MyNamedObject('obj2')
          , query1 = Pd.getNamedObjects('namedObj', 'obj1')
          , query2 = Pd.getNamedObjects('namedObj', 'obj2')
          , query3 = Pd.getNamedObjects('namedObj', 'obj3')

        assert.equal(query1.length, 2)
        assert.equal(query1[0], obj1A)
        assert.equal(query1[1], obj1B)
        assert.equal(query2.length, 1)
        assert.equal(query2[0], obj2)
        assert.equal(query3.length, 0)
      })

      it('should update the register when changing name', function() {
        var obj = new MyNamedObject('obj1')
          , query = Pd.getNamedObjects('namedObj', 'obj1')

        assert.equal(query.length, 1)
        assert.equal(query[0], obj)

        obj.setName('objONE')
        query = Pd.getNamedObjects('namedObj', 'obj1')
        assert.equal(query.length, 0)
        query = Pd.getNamedObjects('namedObj', 'objONE')
        assert.equal(query.length, 1)
        assert.equal(query[0], obj)
      })

    })

    describe('#uniquely-named objects', function() {

      it('should find the objects properly', function() {
        var obj1 = new MyUNamedObject1('obj1')
          , obj2 = new MyUNamedObject1('obj2')
          , obj3 = new MyUNamedObject2('obj1')
          , query1 = Pd.getNamedObjects('uniqNamedObj1', 'obj1')
          , query2 = Pd.getNamedObjects('uniqNamedObj1', 'obj2')
          , query3 = Pd.getNamedObjects('uniqNamedObj2', 'obj1')
          , query4 = Pd.getNamedObjects('uniqNamedObj1', 'obj3')

        assert.equal(query1.length, 1)
        assert.equal(query1[0], obj1)
        assert.equal(query2.length, 1)
        assert.equal(query2[0], obj2)
        assert.equal(query3.length, 1)
        assert.equal(query3[0], obj3)
        assert.equal(query4.length, 0)
      })

      it('should throw an error when registering two objects same type, same name', function() {
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

      it('should update the register when changing name', function() {
        var obj = new MyNamedObject('obj1')
          , query = Pd.getNamedObjects('namedObj', 'obj1')

        assert.equal(query.length, 1)
        assert.equal(query[0], obj)

        obj.setName('objONE')
        query = Pd.getNamedObjects('namedObj', 'obj1')
        assert.equal(query.length, 0)
        query = Pd.getNamedObjects('namedObj', 'objONE')
        assert.equal(query.length, 1)
        assert.equal(query[0], obj)
      })

    })

  })

  describe('#apply', function() {

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

  describe('clock', function() {

    describe('_tick', function() {

      beforeEach(function() {
        clock.time = 0
        clock.lookAheadTime = 0.1
        clock._events = []
      })

      it('should execute simple events rightly', function() {
        var called = []
          , event1 = clock.schedule(function() { called.push(1) }, 3)
          , event2 = clock.schedule(function() { called.push(2) }, 1.2)
          , event3 = clock.schedule(function() { called.push(3) }, 1.1)    

        // t=0 / look ahead=0.1
        clock._tick()
        assert.deepEqual(called, [])
        clock.time += 1

        // t=1 / look ahead=1.1
        clock._tick()
        assert.deepEqual(called, [3])
        clock.time += 1

        // t=2 / look ahead=2.1
        clock._tick()
        assert.deepEqual(called, [3, 2])
        clock.time += 1

        // t=3 / look ahead=3.1
        clock._tick()
        assert.deepEqual(called, [3, 2, 1])
        clock.time += 1

        // t=4 / look ahead=4.1
        clock._tick()
        assert.deepEqual(called, [3, 2, 1])
        assert.deepEqual(clock._events, [])
      })

      it('should execute repeated events', function() {
        var called = []
          , event1 = clock.schedule(function() { called.push(1) }, 2)
          , event2 = clock.schedule(function() { called.push(2) }, 1, true)
        
        // t=0 / look ahead=0.1
        clock._tick()
        assert.deepEqual(called, [])
        clock.time += 1

        // t=1 / look ahead=1.1
        clock._tick()
        assert.deepEqual(called, [2])
        clock.time += 1
     
        // t=2 / look ahead=2.1
        clock._tick()
        assert.deepEqual(called, [2, 2, 1])
        clock.time += 1

        // t=3 / look ahead=3.1
        clock._tick()
        assert.deepEqual(called, [2, 2, 1, 2])
        clock.time += 1

        // t=4 / look ahead=4.1
        clock._tick()
        assert.deepEqual(called, [2, 2, 1, 2, 2])
        clock.time += 1

        clock.unschedule(event2)
        // t=5 / look ahead=5.1
        clock._tick()
        assert.deepEqual(called, [2, 2, 1, 2, 2])
      })

    })

    describe('_insertEvent', function() {

      it('should insert events at the right position', function() {
        clock._events = [{time: 2}, {time: 3}, {time: 7}, {time: 11}]

        clock._insertEvent({time: 1})
        assert.deepEqual(clock._events, [{time: 1}, {time: 2}, {time: 3},
          {time: 7}, {time: 11}])

        clock._insertEvent({time: 13})
        assert.deepEqual(clock._events, [{time: 1}, {time: 2}, {time: 3},
          {time: 7}, {time: 11}, {time: 13}])

        clock._insertEvent({time: 9})
        assert.deepEqual(clock._events, [{time: 1}, {time: 2}, {time: 3},
          {time: 7}, {time: 9}, {time: 11}, {time: 13}])

        clock._insertEvent({time: 2, bla: 34})
        assert.deepEqual(clock._events, [{time: 1}, {time: 2, bla: 34}, {time: 2},
          {time: 3}, {time: 7}, {time: 9}, {time: 11}, {time: 13}])
      })

    })

    describe('_removeEvent', function() {

      it('should remove events rightly', function() {
        clock._events = [{time: 2}, {time: 3}, {time: 4},
          {time: 10.5}, {time: 11}]

        clock._removeEvent(clock._events[1])
        assert.deepEqual(clock._events, [{time: 2}, {time: 4}, {time: 10.5},
          {time: 11}])

        clock._removeEvent(clock._events[0])
        assert.deepEqual(clock._events, [{time: 4}, {time: 10.5}, {time: 11}])

        clock._removeEvent(clock._events[clock._events.length - 1])
        assert.deepEqual(clock._events, [{time: 4}, {time: 10.5}])
      })

    })

    describe('_indexByTime', function() {
      
      it('should find the right index', function() {
        clock._events = [{time: 2}, {time: 3}, {time: 7}, {time: 7},
          {time: 7}, {time: 11}]

        assert.equal(clock._indexByTime(3), 1)
        assert.equal(clock._indexByTime(2), 0)
        assert.equal(clock._indexByTime(11), 5)
        assert.equal(clock._indexByTime(7), 2)
        assert.equal(clock._indexByTime(6.5), 2)
      })

    })

  })


})

