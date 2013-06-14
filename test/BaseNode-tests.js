var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../lib/portlets')
  , BaseNode = require('../lib/BaseNode')
  , Patch = require('../lib/Patch')


describe('BaseNode', function() {

  var MyInlet = portlets['inlet'].extend({})

  var MyNode = function() { BaseNode.apply(this, arguments) }
  _.extend(MyNode.prototype, BaseNode.prototype, {

    init: function() { this.initArgs = _.toArray(arguments) },
    inletDefs: [MyInlet, portlets['inlet~']],
    outletDefs: [portlets['outlet'], portlets['outlet~'], portlets['outlet']]

  })

  it('should create inlets and outlets automatically', function() {
    var node = new MyNode()
    assert.equal(node.inlets.length, 2)
    assert.equal(node.outlets.length, 3)
    assert.ok(node.inlets[0] instanceof MyInlet)
    assert.ok(node.inlets[1] instanceof portlets['inlet~'])

    node.inlets.forEach(function(inlet, i) {
      assert.equal(inlet.id, i)
    })
    node.outlets.forEach(function(outlet, i) {
      assert.equal(outlet.id, i)
    })

    assert.ok(node.outlets[0] instanceof portlets['outlet'])
    assert.ok(node.outlets[1] instanceof portlets['outlet~'])
    assert.ok(node.outlets[2] instanceof portlets['outlet'])
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

  describe('i/o', function() {
    
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

})

