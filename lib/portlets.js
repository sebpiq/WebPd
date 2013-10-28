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
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils')

var BasePortlet = function(obj, id) {
  this.obj = obj
  this.id = id
  this.init()
}
inherits(BasePortlet, EventEmitter)

_.extend(BasePortlet.prototype, {

  // True if the portlet can connect objects belonging to different patches
  crossPatch: false,

  init: function() {},

  // Connects two portlets together
  connect: function(other) { throw new Error('not implemented') },

  // Disconnects two portlets
  disconnect: function(other) { throw new Error('not implemented') },

  // Generic function for connecting the calling portlet 
  // with `otherPortlet`. Returns true if a connection was indeed established
  _genericConnect: function(allConn, otherPortlet) {
    if (allConn.indexOf(otherPortlet) !== -1) return false
    if (!(this.crossPatch || otherPortlet.crossPatch)
    && this.obj.patch !== otherPortlet.obj.patch)
      throw new Error('cannot connect objects that belong to different patches')
    allConn.push(otherPortlet)
    otherPortlet.connect(this)
    this.emit('connection', otherPortlet)
    return true
  },

  // Generic function for disconnecting the calling portlet 
  // from  `otherPortlet`. Returns true if a disconnection was indeed made
  _genericDisconnect: function(allConn, otherPortlet) {
    var connInd = allConn.indexOf(otherPortlet)
    if (connInd === -1) return false
    allConn.splice(connInd, 1)
    otherPortlet.disconnect(this)
    this.emit('disconnection', otherPortlet)
    return true
  }

})
BasePortlet.extend = utils.chainExtend

var BaseInlet = BasePortlet.extend({

  init: function() {
    this.sources = []
  },

  connect: function(source) {
    this._genericConnect(this.sources, source)
  },

  disconnect: function(source) {
    this._genericDisconnect(this.sources, source)
  },

  message: function() {
    this.obj.message.apply(this.obj, [this.id].concat(_.toArray(arguments)))
  }

})

var BaseOutlet = BasePortlet.extend({

  init: function() {
    this.sinks = []
  },

  connect: function(sink) {
    this._genericConnect(this.sinks, sink)
  },

  disconnect: function(sink) {
    this._genericDisconnect(this.sinks, sink)
  }

})


// message inlet.
module.exports['inlet'] = BaseInlet.extend({})

// message outlet. Dispatches messages to all the sinks
module.exports['outlet'] = BaseOutlet.extend({

  message: function() {
    var args = arguments
    this.sinks.forEach(function(sink) {
      sink.message.apply(sink, args)
    })
  }

})

// dsp inlet.
module.exports['inlet~'] = BaseInlet.extend({
})

// dsp outlet.
module.exports['outlet~'] = BaseOutlet.extend({

  message: function() {
    throw new Error ('dsp outlet received a message')
  },

  connect: function(sink) {
    BaseOutlet.prototype.connect.call(this, sink)
  }

})

