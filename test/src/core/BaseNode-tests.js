var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../../../lib/core/portlets')
  , BaseNode = require('../../../lib/core/BaseNode')
  , Patch = require('../../../lib/core/Patch')


describe('core.BaseNode', function() {

  var MyInlet = portlets.Inlet.extend({})
  var MyOutlet = portlets.Outlet.extend({})

  var MyNode = function() { BaseNode.apply(this, arguments) }
  _.extend(MyNode.prototype, BaseNode.prototype, {

    init: function() { this.initArgs = _.toArray(arguments) },
    inletDefs: [MyInlet, portlets.Inlet],
    outletDefs: [portlets.Outlet, MyOutlet, portlets.Outlet]

  })

  it('should create inlets and outlets automatically', function() {
    var node = new MyNode()
    assert.equal(node.inlets.length, 2)
    assert.equal(node.outlets.length, 3)
    assert.ok(node.inlets[0] instanceof MyInlet)
    assert.ok(node.inlets[1] instanceof portlets.Inlet)

    node.inlets.forEach(function(inlet, i) {
      assert.equal(inlet.id, i)
    })
    node.outlets.forEach(function(outlet, i) {
      assert.equal(outlet.id, i)
    })

    assert.ok(node.outlets[0] instanceof portlets.Outlet)
    assert.ok(node.outlets[1] instanceof MyOutlet)
    assert.ok(node.outlets[2] instanceof portlets.Outlet)
  })

  it('should handle creation arguments rightly', function() {
    var node = new MyNode()
      , patch = new Patch
    assert.equal(node.patch, null)
    assert.deepEqual(node.initArgs, [])
    
    node = new MyNode(1, 2)
    assert.equal(node.patch, null)
    assert.deepEqual(node.initArgs, [1, 2])

    node = new MyNode(1, 2, patch)
    assert.equal(node.patch, patch)
    assert.deepEqual(node.initArgs, [1, 2])

    node = new MyNode(patch)
    assert.equal(node.patch, patch)
    assert.deepEqual(node.initArgs, [])
  })

  describe('.i/o', function() {
    
    it('should return the right inlet/outlet if it exists', function() {
      var node = new MyNode()
      assert.equal(node.i(0), node.inlets[0])
      assert.equal(node.i(1), node.inlets[1])
      assert.equal(node.o(0), node.outlets[0])
      assert.equal(node.o(1), node.outlets[1])
      assert.equal(node.o(2), node.outlets[2])
    })

    it('should raise an error if inlet/outlet doesn\'t exists', function() {
      var node = new MyNode()
      assert.throws(function() { node.i(2) })
      assert.throws(function() { node.o(3) })
    })

  })

  describe('.resolveArgs', function() {

    it('should resolve $-args', function() {
      var patch = new Patch(11, 'abc', 33)
        , node = new BaseNode(patch)
      assert.deepEqual(
        node.resolveArgs([123, '$0', '$1', 456, '$2', '$3']),
        [123, patch.patchId, 11, 456, 'abc', 33]
      )
    })

    it('should resolve abbreviations', function() {
      var node = new BaseNode
      assert.deepEqual(
        node.resolveArgs(['bla', 'bang', 'b', 'f', 'l', 'a', 's']), 
        ['bla', 'bang', 'bang', 'float', 'list', 'anything', 'symbol']
      )
    })

  })

  describe('.getDollarResolver', function() {

    it('should resolve $-args', function() {
      var node = new BaseNode
        , resolver = node.getDollarResolver([1])
      assert.deepEqual(resolver([2, 'bla', 4]), [1])

      resolver = node.getDollarResolver([1, '$1-bla-$3', 'bla', '$3'])
      assert.deepEqual(resolver([0, 'bli', 'bla', 4, 5]), [1, 'bli-bla-4', 'bla', 4])
      assert.deepEqual(resolver([0, 7, 'bloop', 'ploo', 5]), [1, '7-bla-ploo', 'bla', 'ploo'])
    })

    it('should throw an error if $-arg out of range', function() {
      var node = new BaseNode
        , resolver = node.getDollarResolver(['$5'])
      assert.throws(function() { resolver([1, 2]) })
    })

  })

})

