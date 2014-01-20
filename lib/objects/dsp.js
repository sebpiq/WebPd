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
  , portlets = require('./portlets')
  , pdGlob = require('../global')
  , audiokit = require('audiokit')

exports.declareObjects = function(exports) {

// TODO: dsp signal to first inlet
// TODO: phase
exports['osc~'] = PdObject.extend({

  inletDefs: [

    portlets.Inlet.extend({
      message: function(frequency) {
        expect(frequency).to.be.a('number', 'osc~::frequency')
        this.obj.frequency = frequency
        this.obj.sine.phasor.parameters.frequency = frequency
      }
    })

  ],

  outletDefs: [portlets.DspOutlet],

  init: function(frequency) {
    this.frequency = frequency || 0
  },

  start: function() {
    this.sine = new audiokit.Nodes.Sine({
      sampleRate: this.patch.sampleRate,
      blockSize: this.patch.blockSize
    })
    this.i(0).message(this.frequency)
  },

  stop: function() {},

  _tick: function() {
    var block = new Float32Array(pdGlob.settings.blockSize)
    if (this.inlets[0].connections.length > 0)
      this.sine.process(block, this.inlets[0]._tick())
    else
      this.sine.process(block)
    return block
  }

})

exports['dac~'] = PdObject.extend({

  endPoint: true,

  inletDefs: [portlets.DspInlet, portlets.DspInlet],

  _tick: function() {
    var block = this.inlets.map(function(inlet) { return inlet._tick() })
    pdGlob.audio.buffer.push(block)
  }

})

}
