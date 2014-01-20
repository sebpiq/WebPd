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
  , pdGlob = require('../global')
  , frame = 0
  , AudioDriver

// Audio drivers have a very simple interface : 
//
//    - new AudioDriver(process) : where `process(inputData, outputData)` is the loop executed for each dsp tick
//    - start() : start the audio loop
//    - stop() : stops the audio loop
//
if (typeof window !== 'undefined')
  AudioDriver = require('./WebAudioApi')
else
  AudioDriver = require('./Dummy')

// The main dsp loop
var driver = module.exports = new AudioDriver(function(inputData, outputData) {

  // Update time
  frame += pdGlob.settings.blockSize
  pdGlob.clock.time = frame / pdGlob.settings.sampleRate * 1000
  pdGlob.clock._tick()

  // Pull audio from end points
  pdGlob.patches.forEach(function(patch) {
    patch.endPoints.forEach(function(endPoint) {
      endPoint._tick()
    })
  })
  
  // Write a block to the output
  var block = driver.buffer.shift()
  outputData[0].set(block[0])
  outputData[1].set(block[1])

})

// Update globals according to the actual sample rate and blocksize
pdGlob.settings.sampleRate = driver.sampleRate
pdGlob.clock.lookAheadTime = pdGlob.settings.blockSize / pdGlob.settings.sampleRate * 1000
