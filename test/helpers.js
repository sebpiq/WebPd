var _ = require('underscore')
  , chai = require('chai')
  , chaiStats = require('chai-stats')
chai.use(chaiStats)

exports.expectSamples = function(expected, done) {
  var channelCount = expected.length
    , frameCount = expected[0].length
    , context = new OfflineAudioContext(channelCount, frameCount, Pd.getSampleRate())
  Pd._glob.audio.context = context

  context.oncomplete = function(event) {
    var ch, actual = []
    for (ch = 0; ch < channelCount; ch++) {  
      actual.push(_.toArray(event.renderedBuffer.getChannelData(ch)))
      expected[ch] = _.toArray(expected[ch])
    }
    for (ch = 0; ch < channelCount; ch++) {
      try {
        chai.assert.deepAlmostEqual(
          _.toArray(event.renderedBuffer.getChannelData(ch)),
          _.toArray(expected[ch])
        , 4)
      } catch (err) {
        if (err instanceof chai.AssertionError)
          done(new chai.AssertionError('expected \n' + actual.map(JSON.stringify).join('\n')
            + '\n to be about equal \n' + expected.map(JSON.stringify).join('\n')))
        else done(err)
      }
    }
    done()
  }
  Pd.start()
  context.startRendering()
}