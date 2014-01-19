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
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')

var Portlet = exports.Portlet = function(obj, id) {
  this.obj = obj
  this.id = id
  this.connections = []
  this.init()
}
inherits(Portlet, EventEmitter)

_.extend(Portlet.prototype, {

  // True if the portlet can connect objects belonging to different patches
  crossPatch: false,

  // Connects the calling portlet with `otherPortlet` 
  // Returns true if a connection was indeed established.
  connect: function(otherPortlet) {
    if (this.connections.indexOf(otherPortlet) !== -1) return false
    if (!(this.crossPatch || otherPortlet.crossPatch)
    && this.obj.patch !== otherPortlet.obj.patch)
      throw new Error('cannot connect objects that belong to different patches')
    this.connections.push(otherPortlet)
    otherPortlet.connect(this)
    this.emit('connection', otherPortlet)
    return true
  },

  // Generic function for disconnecting the calling portlet 
  // from  `otherPortlet`. Returns true if a disconnection was indeed made
  disconnect: function(otherPortlet) {
    var connInd = this.connections.indexOf(otherPortlet)
    if (connInd === -1) return false
    this.connections.splice(connInd, 1)
    otherPortlet.disconnect(this)
    this.emit('disconnection', otherPortlet)
    return true
  },

  init: function() {},

  message: function() {}

})
Portlet.extend = utils.chainExtend

var Inlet = exports.Inlet = Portlet.extend({

  message: function() {
    this.obj.message.apply(this.obj, [this.id].concat(_.toArray(arguments)))
  }

})

var Outlet = exports.Outlet = Portlet.extend({})


// message inlet.
exports['inlet'] = Inlet.extend({})

// message outlet. Dispatches messages to all the sinks
exports['outlet'] = Outlet.extend({

  message: function() {
    var args = arguments
    this.connections.forEach(function(sink) {
      sink.message.apply(sink, args)
    })
  }

})

// dsp inlet.
exports['inlet~'] = Inlet.extend({})

// dsp outlet.
exports['outlet~'] = Outlet.extend({

  message: function() {
    throw new Error ('dsp outlet received a message')
  }

})

