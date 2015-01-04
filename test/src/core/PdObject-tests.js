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

})

