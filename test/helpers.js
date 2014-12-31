var _ = require('underscore')
  , waatest = require('waatest')

exports.expectSamples = function(onStarted, expected, done) {
  waatest.utils.expectSamples(function(context) {
    var channelCount = expected.length
      , audio = new TestAudio(channelCount, context)
    Pd.start(audio)
    onStarted()
  }, expected, done)
}


/*
// Generate one audio block, compare it with `expected` and calls `done(err)`
exports.expectSamples = function(onStarted, expected, done) {
  var channelCount = expected.length
    , frameCount = expected[0].length
    , audio = new TestAudio(channelCount, frameCount)

  audio.context.oncomplete = function(event) {
    var ch, actual = []
    for (ch = 0; ch < channelCount; ch++)  
      actual.push(_.toArray(event.renderedBuffer.getChannelData(ch)))
    try { assertBlocksEqual(actual, expected) } catch(err) { done(err) }
    done()
  }
  Pd.start(audio)
  if ()onStarted()
  audio.context.startRendering()
}
*/

// Audio engine for testing
var TestAudio = function(channelCount, context) {
  var ch
  this.context = context
  this._channelMerger = this.context.createChannelMerger(channelCount)
  this._channelMerger.connect(this.context.destination)
  this.channels = []
  for (ch = 0; ch < channelCount; ch++) {
    this.channels.push(this.context.createGain())
    this.channels[ch].connect(this._channelMerger, 0, ch)
  }
}
TestAudio.prototype.start = function() {}
TestAudio.prototype.stop = function() {}