/*
 * Copyright (c) 2011-2014 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

var _ = require('underscore')
  , global = global || window
  , AudioContext = global.webkitAudioContext || global.AudioContext
  , ACProto
if (!AudioContext) throw new Error('your browser doesn\'t seem to support web audio api')

ACProto = AudioContext.prototype
ACProto.createScriptProcessor = ACProto.createScriptProcessor || ACProto.createJavaScriptNode

var WebAudioApi = module.exports = function(process, opts) {
  this.context = new AudioContext()
  this.scriptNode = this.context.createScriptProcessor(blockSize, 1, 1)
  this.scriptNode.onaudioprocess = function (event) {
    var outputData = process(event.inputBuffer.getChannelData(0), event.inputBuffer.getChannelData(1))
    event.outputBuffer.getChannelData(0).set(outputData[0])
    event.outputBuffer.getChannelData(1).set(outputData[1])
  }
}

_.extend(WebAudioApi.prototype, {

  start: function() {
    this.scriptNode.connect(this.context.destination)
  },

  stop: function() {
    this.scriptNode.disconnect(this.context.destination)
  }

})
