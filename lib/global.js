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
  , utils = require('./core/utils')
  , EventEmitter = require('events').EventEmitter


// Global settings
exports.settings = {

  // Current sample rate
  sampleRate: 44100,
  
  // Current block size
  blockSize: 16384,

  // Current number of channels
  channelCount: 2
}


// true if dsp is started, false otherwise 
exports.isStarted = false


// Global event emitter
var emitter = exports.emitter = new EventEmitter()


// The library of objects that can be created
exports.library = {}


// List of all patches currently open
exports.patches = {}


// Audio engine. Must implement the `interfaces.Audio`
exports.audio = null


// The clock used to schedule stuff. Must implement the `interfaces.Clock`
exports.clock = null


// File storage
exports.storage = null


// Store containing named objects (e.g. arrays, [delread~], ...).
exports.namedObjects = null
