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

  init: function() {},

  connect: function(other) { throw new Error('not implemented') },

  disconnect: function(other) { throw new Error('not implemented') },

  // Generic function for connecting the calling portlet 
  // with `otherPortlet`. Returns true if a connection was indeed established
  _genericConnect: function(allConn, otherPortlet) {
    if (allConn.indexOf(otherPortlet) !== -1) return false
    if (this.obj.patch !== otherPortlet.obj.patch)
      throw new Error('cannot connect objects that belong to different patches')
    allConn.push(otherPortlet)
    otherPortlet.connect(this)
    return true
  },

  // Generic function for disconnecting the calling portlet 
  // from  `otherPortlet`. Returns true if a disconnection was indeed made
  _genericDisconnect: function(allConn, otherPortlet) {
    var connInd = allConn.indexOf(otherPortlet)
    if (connInd === -1) return false
    allConn.splice(connInd, 1)
    otherPortlet.disconnect(this)
    return true
  }

})
BasePortlet.extend = utils.chainExtend

var BaseInlet = BasePortlet.extend({

  init: function() {
    this.sources = []
  },

  // Connects the inlet to the outlet `source`. 
  // If the connection already exists, nothing happens.
  connect: function(source) {
    if (this._genericConnect(this.sources, source))
      this.emit('connection', source)
  },

  // Disconnects the inlet from the outlet `source`.
  // If the connection didn't exist, nothing happens.
  disconnect: function(source) {
    if (this._genericDisconnect(this.sources, source))
      this.emit('disconnection', source)
  },

  // message received callback
  message: function() {
    this.obj.message.apply(this.obj, [this.id].concat(Array.prototype.slice.call(arguments)))
  }

})

var BaseOutlet = BasePortlet.extend({

  init: function() {
    this.sinks = []
  },

  // Connects the outlet to the inlet `sink`. 
  // If the connection already exists, nothing happens.
  connect: function(sink) {
    if (this._genericConnect(this.sinks, sink))
      this.emit('connection', sink)
  },

  // Disconnects the outlet from the inlet `sink`.
  // If the connection didn't exist, nothing happens.
  disconnect: function(sink) {
    if (this._genericDisconnect(this.sinks, sink))
      this.emit('disconnection', sink)
  },

  // Sends a message to all sinks
  message: function() { throw new Error('not implemented') }

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

  getWAA: function() { throw new Error('Implement me') }

})

// dsp outlet.
module.exports['outlet~'] = BaseOutlet.extend({

  message: function() {
    throw new Error ('dsp outlet received a message')
  },

  connect: function(sink) {
    BaseOutlet.prototype.connect.call(this, sink)
    var sinkWAA = sink.getWAA()
      , sourceWAA = this.getWAA()
    sourceWAA[0].connect(sinkWAA[0], sourceWAA[1], sinkWAA[1])
  },

  getWAA: function() { throw new Error('Implement me') }

})

