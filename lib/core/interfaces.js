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
 
// Scheduler to handle timing
exports.Clock = {

  // Current time of the clock in milliseconds
  time: 0,

  // Schedule `func` to run in `relativeTime` from now. Returns an `Event`
  schedule: function(func, relativeTime, isRepeated) {},

  // Unschedule `event`
  unschedule: function(event) {}
}

// Audio engine
exports.Audio = {

  // Start the audio
  start: function() {},

  // Stop the audio
  stop: function() {},

  // Decode array buffer to a list of channels of Float32Array
  decode: function(arrayBuffer, done) { done(null, arrayBuffer) }
}

// File storage
exports.Storage = {

  // Gets the file stored at `uri` and returns `done(err, arrayBuffer)`
  get: function(uri, done) { }
}