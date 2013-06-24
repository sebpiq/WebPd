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
  , utils = require('./utils')
  , objects = require('./objects')
  , BaseNode = require('./BaseNode')
  , isInletObject = function(obj) {
    var lib = require('./objects')
    return [lib['inlet'], lib['inlet~']].some(function(type) {
      return obj instanceof type
    })
  }
  , isOutletObject = function(obj) {
    var lib = require('./objects')
    return [lib['outlet'], lib['outlet~']].some(function(type) {
      return obj instanceof type
    })
  }

var Patch = module.exports = function() {
  BaseNode.apply(this, arguments)

  // Patch-specific attributes
  this.objects = []
  this.patchId = null         // A globally unique id for the patch

  // The patch registers to Pd
  require('../index').register(this)
}

_.extend(Patch.prototype, BaseNode.prototype, utils.UniqueIdsMixin, {

  type: 'patch',

  init: function() {
    this.args = _.toArray(arguments)
  },

  start: function() {
    this.objects.forEach(function(obj) { obj.start() })
  },

  stop: function() {
    this.objects.forEach(function(obj) { obj.stop() })
  },

  // Adds an object to the patch.
  // Also causes the patch to automatically assign an id to that object.
  // This id can be used to uniquely identify the object in the patch.
  // Also, if the patch is playing, the `load` method of the object will be called.
  register: function(obj) {
    if (this.objects.indexOf(obj) === -1) {
      var Pd = require('../index')
        , id = this._generateId()
      obj.id = id
      obj.patch = this
      this.objects[id] = obj
      if (Pd.isStarted()) obj.start()
    }

    // When [inlet], [outlet~], ... is added to a patch, we add their portlets
    // to the patch's portlets
    if (isInletObject(obj)) {
      this.inlets.push(obj.inlets[0])
    }
    if (isOutletObject(obj)) {
      this.outlets.push(obj.outlets[0])
    }
  }

})
