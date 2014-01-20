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
  , patchIds = _.extend({}, utils.UniqueIdsMixin)


// Global settings
exports.settings = {

  // Current sample rate
  sampleRate: 44100,
  
  // Current block size
  blockSize: 16384
}


// true if dsp is started, false otherwise 
exports.isStarted = false


// Global event emitter
var emitter = exports.emitter = new EventEmitter()


// Registering a newly created patch 
exports.register = function(patch) {
  if (this.patches.indexOf(patch) === -1) {
    this.patches.push(patch)
    patch.patchId = patchIds._generateId()
  }
}
exports.patches = []


// The patch to which new objects are added to by default
exports.defaultPatch = null


// The clock used to schedule stuff
exports.clock = null


// The audio driver
exports.audio = null
