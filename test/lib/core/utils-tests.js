var _ = require('underscore')
  , assert = require('assert')
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

})

