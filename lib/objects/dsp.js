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
  , WAAOffset = require('waaoffset')
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , portlets = require('./portlets')
  , pdGlob = require('../global')

exports.declareObjects = function(exports) {

// TODO: dsp signal to first inlet
// TODO: phase
exports['osc~'] = PdObject.extend({

  inletDefs: [

    portlets.DspInlet.extend({
      message: function(frequency) {
        if (!this.hasDspSource()) {
          expect(frequency).to.be.a('number', 'osc~::frequency')
          this.obj.frequency = frequency
          if (this.obj._oscNode)
            this.obj._oscNode.frequency.setValueAtTime(frequency, 0)
        }
      }
    }),

    portlets.Inlet.extend({
      message: function(phase) {
        if (this.obj._oscNode) {
          expect(frequency).to.be.a('number', 'osc~::phase')
          this.obj._createOscillator(phase)
        }
      }
    })

  ],

  outletDefs: [portlets.DspOutlet],

  init: function(frequency) {
    this.frequency = frequency || 0
  },

  start: function() {
    this._createOscillator(0)
  },

  stop: function() {
    this._oscNode.stop(0)
    this._oscNode = null
  },

  _createOscillator: function(phase) {
    this._oscNode = pdGlob.audio.context.createOscillator()
    this._oscNode.setPeriodicWave(pdGlob.audio.context.createPeriodicWave(
      new Float32Array([0, 1]), new Float32Array([0, 0])))
    this._oscNode.start(0)
    this.o(0).waa = { node: this._oscNode, output: 0 }
    this.i(0).waa = { node: this._oscNode.frequency, output: 0 }
    this.i(0).message(this.frequency)
  }

})


exports['line~'] = PdObject.extend({

  inletDefs: [

    portlets.Inlet.extend({
      message: function(value, time) {
        expect(value).to.be.a('number', 'line~::value')
        if (time) {
          expect(time).to.be.a('number', 'line~::time')
          this.obj._offsetNode.offset.linearRampToValueAtTime(value, 
            pdGlob.audio.context.currentTime + time / 1000)
        } else
          this.obj._offsetNode.offset.setValueAtTime(value, 0)
      }
    })

  ],

  outletDefs: [portlets.DspOutlet],

  init: function() {},

  start: function() {
    this._offsetNode = new WAAOffset(pdGlob.audio.context)
    this._offsetNode.offset.setValueAtTime(0, 0)
    this.o(0).waa = { node: this._offsetNode, output: 0 }
  },

  stop: function() {
    this._offsetNode.disconnect()
    this._offsetNode = null
  }

})


exports['dac~'] = PdObject.extend({

  endPoint: true,

  inletDefs: [portlets.DspInlet, portlets.DspInlet],

  start: function() {
    this.i(0).waa = { node: pdGlob.audio.channels[0], input: 0 }
    this.i(1).waa = { node: pdGlob.audio.channels[1], input: 1 }
  }

})

}
