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
  , ArrayMath = require('dsp').ArrayMath
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , BaseInlet = require('../core/portlets').Inlet
  , BaseOutlet = require('../core/portlets').Outlet
  , pdGlob = require('../global')

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
var DspInlet = exports.DspInlet = BaseInlet.extend({

  // Pulls the audio from the nodes upstream, mixing the blocks together
  _tick: function() {
    var block = new Float32Array(pdGlob.settings.blockSize)
    this.connections.forEach(function(source) {
      ArrayMath.add(block, block, source._tick())
    })
    return block
  }

})

// dsp outlet.
var DspOutlet = exports.DspOutlet = BaseOutlet.extend({

  init: function() {
    // This caches the block fetched from the node. 
    this._cachedBlock = {time: -1, block: null}
  },

  message: function() {
    throw new Error ('dsp outlet received a message')
  },

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  _tick: function() {
    if (this._cachedBlock.time < pdGlob.clock.time) {
      var block = this.obj._tick()
      this._cachedBlock = {time: pdGlob.clock.time, block: block}
    }
    return this._cachedBlock.block
  }

})

exports.declareObjects = function(exports) {

  var InletInlet = Inlet.extend({
    message: function() {
      var outlet = this.obj.outlets[0]
      outlet.message.apply(outlet, arguments)
    }
  })

  var InletInletDsp = InletInlet.extend({})

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

  exports['outlet'] = PdObject.extend({
    inletDefs: [ InletInlet ],
    outletDefs: [ Outlet.extend({ crossPatch: true }) ]
  })

  exports['inlet'] = PdObject.extend({
    inletDefs: [ InletInlet.extend({ crossPatch: true }) ],
    outletDefs: [ Outlet ]
  })

  exports['outlet~'] = PdObject.extend({
    inletDefs: [ InletInletDsp ],
    outletDefs: [ OutletOutletDsp.extend({ crossPatch: true }) ]
  })

  exports['inlet~'] = PdObject.extend({
    inletDefs: [ InletInletDsp.extend({ crossPatch: true }) ],
    outletDefs: [ OutletOutletDsp ]
  })

}
