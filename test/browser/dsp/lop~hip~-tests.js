var _ = require('underscore')
  , async = require('async')
  , waatest = require('waatest')
  , helpers = require('../../helpers')

describe('dsp.lop~/dsp.hip~', function() {
  var cos = Math.cos
    , sin = Math.sin

  afterEach(function() { helpers.afterEach() })

  describe('i(0)', function() {

    it.skip('should cut low frequencies of input', function(done) {
      var patch = Pd.createPatch()
        , osc = patch.createObject('osc~', [440])
        , lop = patch.createObject('lop~', [220])
        , dac = patch.createObject('dac~')
        , k = 2*Math.PI*440 / Pd.getSampleRate()

      osc.o(0).connect(lop.i(0))
      lop.o(0).connect(dac.i(0))

      helpers.renderSamples(2, 441, function() {}, function(err, actual) {
        if (err) return done(err)
        var peak = _.max(actual[0].slice(50))
          , expected = waatest.utils.makeBlock(2, 441, [
            function(ch, i) { return peak * cos(k * i) }, 0
          ])
        try { waatest.utils.assertBlocksEqual(actual, expected) } catch(err) { return done(err) }
        done()
      })
    })

  })

})