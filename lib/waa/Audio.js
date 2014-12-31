var Audio = module.exports = function(channelCount) {
  var ch
  this.context = new AudioContext()
  this._channelMerger = this.context.createChannelMerger(channelCount)
  this._channelMerger.connect(this.context.destination)
  this.channels = []
  for (ch = 0; ch < channelCount; ch++) {
    this.channels.push(this.context.createGain())
    this.channels[ch].connect(this._channelMerger, 0, ch)
  }
}

Audio.prototype.start = function() {}
Audio.prototype.stop = function() {}