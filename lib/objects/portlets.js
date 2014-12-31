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

  hasDspSource: function() {
    return _.filter(this.connections, function(outlet) {
      return outlet instanceof DspOutlet
    }).length > 0
  }

})

// dsp outlet.
var DspOutlet = exports.DspOutlet = BaseOutlet.extend({

  connection: function(inlet) {
    if (pdGlob.isStarted) {
      if (inlet.waa.node instanceof AudioParam)
        this.waa.node.connect(inlet.waa.node, this.waa.output)
      else
        this.waa.node.connect(inlet.waa.node, this.waa.output, inlet.waa.input)
    }
  },

  disconnection: function(inlet) {
    if (pdGlob.isStarted)
      this.waa.node.disconnect(inlet.waa.node, this.waa.output)
  },

  message: function() {
    throw new Error ('dsp outlet received a message')
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
