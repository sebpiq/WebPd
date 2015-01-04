var assert = require('assert')
  , _ = require('underscore')
  , Pd = require('../../../index')
  , portlets = require('../../../lib/core/portlets')
  , PdObject = require('../../../lib/core/PdObject')
  , Patch = require('../../../lib/core/Patch')
  , helpers = require('../../helpers')


describe('core.PdObject', function() {

  var MyObject = PdObject.extend({ type: 'MyObject' })

  afterEach(function() { helpers.afterEach() })

  it('should register to its patch', function() {
    var patch = new Patch
      , obj = new MyObject([], patch)
    assert.ok(_.contains(patch.objects, obj))
    assert.ok(_.isNumber(obj.id))
    assert.ok(obj.patch, patch)
  })

  it('should register to the default patch if no patch given', function() {
    Pd.start()
    var obj = new MyObject([])
      , patch = Pd.getDefaultPatch()
    assert.ok(_.contains(patch.objects, obj))
    assert.ok(_.isNumber(obj.id))
    assert.ok(obj.patch, patch)
  })

})

