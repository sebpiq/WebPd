var _ = require('underscore')
  , waatest = require('waatest')
  , Pd = require('../index')
  , pdGlob = require('../lib/global')

exports.afterEach = function() {
  pdGlob.namedObjects = null
  pdGlob.patches = {}
  pdGlob.library = {}
  require('../lib/objects').declareObjects(pdGlob.library)
  Pd.stop()
}

exports.expectSamples = function(onStarted, expected, done) {
  waatest.utils.expectSamples(function(context) {
    var channelCount = expected.length
      , audio = new TestAudio(channelCount, context)
    Pd.start(audio)
    onStarted()
  }, expected, function(err) {
    Pd.stop()
    done(err)
  })
}

exports.renderSamples = function(channelCount, frameCount, onStarted, done) {
  waatest.utils.renderSamples(channelCount, frameCount, function(context) {
    var audio = new TestAudio(channelCount, context)
    Pd.start(audio)
    onStarted()
  }, function(err, block) {
    Pd.stop()
    done(err, block)
  })
}

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