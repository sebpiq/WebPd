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
  , expect = require('chai').expect
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , BaseInlet = require('../core/portlets').Inlet
  , BaseOutlet = require('../core/portlets').Outlet

// message inlet.
var Inlet = exports.Inlet = BaseInlet.extend({})

// message outlet. Dispatches messages to all the sinks
var Outlet = exports.Outlet = BaseOutlet.extend({

  message: function() {
    var args = arguments
    this.connections.forEach(function(sink) {
      sink.message.apply(sink, args)
    })
  }

})

// dsp inlet.
var DspInlet = exports.DspInlet = Inlet.extend({})

// dsp outlet.
var DspOutlet = exports.DspOutlet = Outlet.extend({

  message: function() {
    throw new Error ('dsp outlet received a message')
  }

})



/*
  // This caches the block fetched from the node. 
  this._cachedBlock = {time: -1, buffer: null}

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  _tick: function() {
    var self = this
    if (this._cachedBlock.time < this.context.currentTime) {
      var outBuffer = this.node._tick()
      if (self._numberOfChannels !== outBuffer.numberOfChannels) {
        self._numberOfChannels = outBuffer.numberOfChannels
        self.emit('_numberOfChannels')
      }
      self._cachedBlock = {time: self.context.currentTime, buffer: outBuffer}
      return outBuffer
    } else return this._cachedBlock.buffer
  }
*/

exports.declareObjects = function(exports) {

var InletInlet = Inlet.extend({
  message: function() {
    var outlet = this.obj.outlets[0]
    outlet.message.apply(outlet, arguments)
  }
})

var InletInletDsp = InletInlet.extend({
})

var OutletOutletDsp = DspOutlet.extend({
  message: function() {
    var args = arguments
    // Normal dsp outlets cannot receive messages,
    // but this one just transmits them unchanged.
    this.sinks.forEach(function(sink) {
      sink.message.apply(sink, args)
    })
  }
})

var DspPortletObjectMixin = {
  init: function() {
  }
}

exports['outlet'] = PdObject.extend({
  inletDefs: [ InletInlet ],
  outletDefs: [ Outlet.extend({ crossPatch: true }) ]
})

exports['inlet'] = PdObject.extend({
  inletDefs: [ InletInlet.extend({ crossPatch: true }) ],
  outletDefs: [ Outlet ]
})

exports['outlet~'] = PdObject.extend(DspPortletObjectMixin, {
  inletDefs: [ InletInletDsp ],
  outletDefs: [ OutletOutletDsp.extend({ crossPatch: true }) ]
})

exports['inlet~'] = PdObject.extend(DspPortletObjectMixin, {
  inletDefs: [ InletInletDsp.extend({ crossPatch: true }) ],
  outletDefs: [ OutletOutletDsp ]
})

}
