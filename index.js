/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , objects = require('./lib/objects')
  , Patch = require('./lib/Patch')
  , utils = require('./lib/utils')

var Pd = module.exports = {

  WAAContext: null,

  patches: [],  

  lib: objects,

  start: function() {
    if (!this.isStarted()) {
      this.patches.forEach(function(patch) { patch.start() })
      this._isStarted = true
    }
  },

  stop: function() {
    if (this.isStarted()) {
      this.patches.forEach(function(patch) { patch.stop() })
      this._isStarted = false
    }
  },

  isStarted: function() {
    return this._isStarted
  },
  _isStarted: false,

  getDefaultPatch: function() {
    this._defaultPatch = new Patch()
    this.getDefaultPatch = function() { return Pd._defaultPatch }
    return this._defaultPatch
  },

  register: function(patch) {
    if (this.patches.indexOf(patch) === -1) {
      this.patches.push(patch)
      patch.id = this._generateId()
    }
  }
}

_.extend(Pd, utils.UniqueIdsMixin)
if (typeof window !== 'undefined') window.Pd = Pd
if (typeof webkitAudioContext !== 'undefined') Pd.WAAContext = new webkitAudioContext()
