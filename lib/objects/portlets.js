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

// dsp inlet.
var DspInlet = exports.DspInlet = BaseInlet.extend(InletMixin, {

  hasDspSource: function() {
    return _.filter(this.connections, function(outlet) {
      return outlet instanceof DspOutlet
    }).length > 0
  },

  setWaa: function(node, input) {
    var self = this
    if (pdGlob.isStarted) {
      _.chain(this.connections)
        .filter(function(outlet) { return outlet instanceof DspOutlet })
        .forEach(function(outlet) { outlet._waaDisconnect(self) }).value()
    }
    this._waa = { node: node, input: input }
    if (pdGlob.isStarted) {
      _.chain(this.connections)
        .filter(function(outlet) { return outlet instanceof DspOutlet })
        .forEach(function(outlet) { outlet._waaConnect(self) }).value()
    }
  }

})

// message outlet. Dispatches messages to all the sinks
var Outlet = exports.Outlet = BaseOutlet.extend({

  message: function(args) {
    this.connections.forEach(function(sink) {
      sink.message(args)
    })
  }

})

// dsp outlet.
var DspOutlet = exports.DspOutlet = BaseOutlet.extend({

  init: function() {
    this._waaConnections = []
  },

  start: function() {
    // Because ATM we cannot disconnect one node from another node
    // without disconnecting all, we have to create a gain node for each
    // new connection.
    this._waaConnectAll()
  },

  stop: function() {
    this._waaDisconnectAll()
    this._waaConnections = []
  },

  connection: function(inlet) {
    if (!(inlet instanceof DspInlet)) 
      throw new Error('can only connect to DSP inlet')
    if (pdGlob.isStarted) this._waaConnect(inlet)
  },

  disconnection: function(inlet) {
    if (pdGlob.isStarted) this._waaDisconnect(inlet)
  },

  message: function() {
    throw new Error ('dsp outlet received a message')
  },

  setWaa: function(node, output) {
    var self = this
    if (pdGlob.isStarted) this._waaDisconnectAll()
    this._waa = { node: node, output: output }
    if (pdGlob.isStarted) this._waaConnectAll()
  },

  _waaConnect: function(inlet) {
    var gainNode = pdGlob.audio.context.createGain()
    this._waa.node.connect(gainNode, this._waa.output)
    this._waaConnections.push({ inlet: inlet, gainNode: gainNode })

    if (inlet._waa.node instanceof AudioParam) {
      inlet._waa.node.setValueAtTime(0, 0) // remove offset from AudioParam
      gainNode.connect(inlet._waa.node, this._waa.output)
    } else
      gainNode.connect(inlet._waa.node, 0, inlet._waa.input)
  },

  _waaDisconnect: function(inlet) {
    // Search for the right waaConnection
    var waaConnection = this._waaConnections.filter(function(waaConnection) {
      return waaConnection.inlet === inlet
    })[0]

    // Disconnect the gain node, and remove the waaConnection from the list
    waaConnection.gainNode.disconnect()
    this._waaConnections = this._waaConnections.filter(function(waaConnection) {
      return waaConnection.inlet !== inlet
    })
  },

  _waaConnectAll: function() {
    // No need to filter dsp inlets as this should refuse connections to non-dsp inlets
    this.connections.forEach(this._waaConnect.bind(this))
  },

  _waaDisconnectAll: function() {
    // No need to filter dsp inlets as this should refuse connections to non-dsp inlets
    this.connections.forEach(this._waaDisconnect.bind(this))
  }

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
    outletDefs: [ OutletOutletDsp.extend({ crossPatch: true }) ]
  })

  library['inlet~'] = PdObject.extend({
    type: 'inlet~',
    inletDefs: [ InletInletDsp.extend({ crossPatch: true }) ],
    outletDefs: [ OutletOutletDsp ]
  })

}
