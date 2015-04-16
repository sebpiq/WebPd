/*
 * Copyright (c) 2011-2015 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , WAAWire = require('waawire')
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , BaseInlet = require('../core/portlets').Inlet
  , BaseOutlet = require('../core/portlets').Outlet
  , pdGlob = require('../global')
  , AudioParam = typeof window !== 'undefined' ? window.AudioParam : function() {} // for testing purpose


// Mixin for common inlet functionalities
var InletMixin = {

  // Allows to deal with Web Audio API's way of scheduling things.
  // This sends a message, but flags it to be executed in the future.
  // That way DSP objects that can schedule stuff, have a bit of time
  // before the event must actually happen.
  future: function(time, args) {
    pdGlob.futureTime = time
    this.message(args)
    delete pdGlob.futureTime
  }

}

// message inlet.
var Inlet = exports.Inlet = BaseInlet.extend(InletMixin)

// message outlet. Dispatches messages to all the sinks
var Outlet = exports.Outlet = BaseOutlet.extend({

  message: function(args) {
    this.connections.forEach(function(sink) {
      sink.message(args)
    })
  }

})

// dsp inlet.
var DspInlet = exports.DspInlet = BaseInlet.extend(InletMixin, {

  hasDspSource: function() {
    return _.filter(this.connections, function(outlet) {
      return outlet instanceof DspOutlet
    }).length > 0
  },

  init: function() {
    this._started = false
  },

  start: function() {
    this._started = true
  },

  stop: function() {
    this._waa = null
    this._started = false
  },

  setWaa: function(node, input) {
    var self = this
    this._waa = { node: node, input: input }

    // remove offset for AudioParam
    if (node instanceof AudioParam) node.setValueAtTime(0, 0)

    if (this._started) {
      _.chain(this.connections)
        .filter(function(outlet) { return outlet instanceof DspOutlet })
        .forEach(function(outlet) { outlet._waaUpdate(self) }).value()
    }
  }

})

// dsp outlet.
var DspOutlet = exports.DspOutlet = BaseOutlet.extend({

  init: function() {
    this._waaConnections = {}
    this._started = false
  },

  start: function() {
    this._started = true
    // No need to filter dsp inlets as this should refuse connections to non-dsp inlets
    this.connections.forEach(this._waaConnect.bind(this))
  },

  stop: function() {
    this._started = false
    // No need to filter dsp inlets as this should refuse connections to non-dsp inlets
    this.connections.forEach(this._waaDisconnect.bind(this))
    this._waaConnections = {}
  },

  connection: function(inlet) {
    if (!(inlet instanceof DspInlet)) 
      throw new Error('can only connect to DSP inlet')
    if (this._started) this._waaConnect(inlet)
  },

  disconnection: function(inlet) {
    if (this._started) this._waaDisconnect(inlet)
  },

  message: function() {
    throw new Error ('dsp outlet received a message')
  },

  setWaa: function(node, output) {
    var self = this
    this._waa = { node: node, output: output }

    // remove offset for AudioParam
    if (node instanceof AudioParam) node.setValueAtTime(0, 0)

    if (this._started) {
      _.values(this._waaConnections).forEach(function(connector) {
        connector.swapSource(node, output)
      })
    }
  },

  _waaConnect: function(inlet) {
    var connector = new WAAWire(pdGlob.audio.context)
    this._waaConnections[this._getConnectionId(inlet)] = connector
    connector.connect(this._waa.node, inlet._waa.node, this._waa.output, inlet._waa.input)
  },

  _waaDisconnect: function(inlet) {
    // Search for the right waaConnection
    var connector = this._waaConnections[this._getConnectionId(inlet)]
    delete this._waaConnections[this._getConnectionId(inlet)]
    connector.close()
  },
  
  _waaUpdate: function(inlet) {
    this._waaConnections[this._getConnectionId(inlet)]
      .swapDestination(inlet._waa.node, inlet._waa.input)
  },

  _getConnectionId: function(inlet) { return inlet.obj.id + ':' + inlet.id }

})

exports.declareObjects = function(library) {

  var InletInlet = Inlet.extend({
    message: function(args) {
      this.obj.outlets[0].message(args)
    }
  })

  var InletInletDsp = DspInlet.extend({
    message: function(args) {
      this.obj.outlets[0].message(args)
    }
  })

  var OutletOutletDsp = DspOutlet.extend({
    message: function(args) {
      // Normal dsp outlets cannot receive messages,
      // but this one just transmits them unchanged.
      this.sinks.forEach(function(sink) {
        sink.message(args)
      })
    }
  })

  library['outlet'] = PdObject.extend({
    type: 'outlet',
    inletDefs: [ InletInlet ],
    outletDefs: [ Outlet.extend({ crossPatch: true }) ]
  })

  library['inlet'] = PdObject.extend({
    type: 'inlet',
    inletDefs: [ InletInlet.extend({ crossPatch: true }) ],
    outletDefs: [ Outlet ]
  })

  library['outlet~'] = PdObject.extend({
    
    type: 'outlet~',
    inletDefs: [ InletInletDsp ],
    outletDefs: [ OutletOutletDsp.extend({ crossPatch: true }) ],

    start: function() {
      this._gainNode = pdGlob.audio.context.createGain()
      this._gainNode.gain.value = 1
      this.i(0).setWaa(this._gainNode, 0)
      this.o(0).setWaa(this._gainNode, 0)
    },

    stop: function() {
      this._gainNode = null
    }
  })

  library['inlet~'] = PdObject.extend({
    type: 'inlet~',
    inletDefs: [ InletInletDsp.extend({ crossPatch: true }) ],
    outletDefs: [ OutletOutletDsp ]
  })

}
