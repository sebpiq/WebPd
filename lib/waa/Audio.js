var Audio = module.exports = function(opts) {
  this.channelCount = opts.channelCount
  this.setContext(opts.audioContext || new AudioContext)
  Object.defineProperty(this, 'time', {
    get: function() { return this.context.currentTime * 1000 },
  })
}

Audio.prototype.start = function() {}

Audio.prototype.stop = function() {}

Audio.prototype.decode = function(arrayBuffer, done) {
  this.context.decodeAudioData(arrayBuffer, 
    function(audioBuffer) {
      var chArrays = [], ch
      for (ch = 0; ch < audioBuffer.numberOfChannels; ch++)
        chArrays.push(audioBuffer.getChannelData(ch))
      done(null, chArrays)
    },
    function(err) {
      done(new Error('error decoding ' + err))
    }
  )
}

// TODO: This is just a hack to be able to override the AudioContext automatically
// created. A cleaner public API for this would be good
Audio.prototype.setContext = function(context) {
  var ch
  this.context = context
  this._channelMerger = this.context.createChannelMerger(this.channelCount)
  this._channelMerger.connect(this.context.destination)
  this.channels = []
  for (ch = 0; ch < this.channelCount; ch++) {
    this.channels.push(this.context.createGain())
    this.channels[ch].connect(this._channelMerger, 0, ch)
  }
}