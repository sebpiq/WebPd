/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
 
// Scheduler to handle timing
exports.Clock = {

  // Current time of the clock in milliseconds
  time: 0,

  // Schedules `func(event)` to run at `time` and to repeat every `repetition` millisecond.
  // Returns an `Event`, that has attribute `timeTag`, which is the time at which it is scheduled.
  // If `time` is now, event must be executed immediately.
  schedule: function(func, time, repetition) {},

  // Unschedules `event`.
  unschedule: function(event) {}
}

// Audio engine
exports.Audio = {

  // The current sample rate of audio processing
  sampleRate: 44100,

  // Start the audio
  start: function() {},

  // Stop the audio
  stop: function() {},

  // Decode array buffer to a list of channels of Float32Array
  decode: function(arrayBuffer, done) { done(null, arrayBuffer) }
}

// Midi engine
exports.Midi = {

  // Tells the midi engine to call `callback` to handle incoming midi messages
  onMessage: function(callback) {}
}

// File storage
exports.Storage = {

  // Gets the file stored at `uri` and returns `done(err, arrayBuffer)`
  get: function(uri, done) { }
}