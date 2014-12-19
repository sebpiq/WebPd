var _ = require('underscore')
  , helpers = require('../../helpers')

describe('dsp.osc~', function() {
  var cos = Math.cos
    , sin = Math.sin

  afterEach(function() {
    Pd.stop()
    Pd.getDefaultPatch().objects = []
  })

  it.skip('should output 1 when no frequency', function(done) {
    var osc = new Pd.lib['osc~']()
      , dac = new Pd.lib['dac~']()
    osc.o(0).connect(dac.i(0))

    helpers.expectSamples([
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

  it.skip('should take frequency as first argument', function(done) {
    var osc = new Pd.lib['osc~'](440)
      , dac = new Pd.lib['dac~']()
      , k = 2*Math.PI*440 / Pd.getSampleRate()
    osc.o(0).connect(dac.i(0))

    helpers.expectSamples([
      [cos(k*1), cos(k*2), cos(k*3), cos(k*4), cos(k*5), cos(k*6), cos(k*7), cos(k*8)],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

  it('WRONG should output 0 when no frequency', function(done) {
    var osc = new Pd.lib['osc~']()
      , dac = new Pd.lib['dac~']()
    osc.o(0).connect(dac.i(0))

    helpers.expectSamples([
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

  it('WRONG should take frequency as first argument', function(done) {
    var osc = new Pd.lib['osc~'](440)
      , dac = new Pd.lib['dac~']()
      , k = 2*Math.PI*440 / Pd.getSampleRate()
    osc.o(0).connect(dac.i(0))

    helpers.expectSamples([
      [0, sin(k*1), sin(k*2), sin(k*3), sin(k*4), sin(k*5), sin(k*6), sin(k*7)],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ], done)
  })

  it.skip('bla', function() {
    // receive frequency message
    var k2 = 2*Math.PI*660/Pd.sampleRate;
    osc.i(0).message(660);
    expected = roundArray([cos(osc.phase+1*k2), cos(osc.phase+2*k2), cos(osc.phase+3*k2), cos(osc.phase+4*k2)], 4);
    osc.dspTick();
    deepEqual(roundArray(outBuff, 4), expected);

    // receive frequency signal
    var m = 2*Math.PI/Pd.sampleRate;
    var inlet0 = osc.i(0);
    inlet0.setBuffer([770, 550, 330, 110]);
    osc.emit('inletConnect');
    expected = [cos(osc.phase+m*770), cos(osc.phase+m*770+m*550), cos(osc.phase+m*770+m*550+m*330), cos(osc.phase+m*770+m*550+m*330+m*110)];
    osc.dspTick();
    deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));
    inlet0.setBuffer([880, 440, 880, 440]);
    expected = [cos(osc.phase+m*880), cos(osc.phase+m*880+m*440), cos(osc.phase+m*880+m*440+m*880), cos(osc.phase+m*880+m*440+m*880+m*440)];
    osc.dspTick();
    deepEqual(roundArray(outBuff, 4), roundArray(expected, 4));
  })

})