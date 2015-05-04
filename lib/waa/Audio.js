/*
 * Copyright (c) 2011-2015 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var pdGlob = require('../global')

var Audio = module.exports = function(opts) {
  if (typeof AudioContext === 'undefined') 
    return console.error('this environment doesn\'t support Web Audio API')
  this.channelCount = opts.channelCount
  this.setContext(opts.audioContext || new AudioContext)
  pdGlob.settings.sampleRate = this.context.sampleRate
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