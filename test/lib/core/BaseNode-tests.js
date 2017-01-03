var assert = require('assert')
  , _ = require('underscore')
  , portlets = require('../../../lib/core/portlets')
  , BaseNode = require('../../../lib/core/BaseNode')
  , Patch = require('../../../lib/core/Patch')
  , errors = require('../../../lib/core/errors')
  , helpers = require('../../helpers')


describe('core.BaseNode', function() {

  var MyInlet = portlets.Inlet.extend({})
  var MyOutlet = portlets.Outlet.extend({})

  var MyNode = function() { BaseNode.apply(this, arguments) }
  _.extend(MyNode.prototype, BaseNode.prototype, {

    init: function(args) { this.initArgs = args },
    inletDefs: [MyInlet, portlets.Inlet],
    outletDefs: [portlets.Outlet, MyOutlet, portlets.Outlet]

  })

  afterEach(function() { helpers.afterEach() })

  describe('.constructor', function() {

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

    it('should call init with arguments', function() {
      var node = new MyNode('patch', 11)
      assert.equal(node.patch, 'patch')
      assert.equal(node.id, 11)
      assert.deepEqual(node.initArgs, [])
      
      node = new MyNode(null, null, [1, 2])
      assert.deepEqual(node.initArgs, [1, 2])
    })
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
      assert.throws(function() { node.i(2) }, errors.InvalidPortletError)
      assert.throws(function() { node.o(3) }, errors.InvalidPortletError)
    })

  })

})

