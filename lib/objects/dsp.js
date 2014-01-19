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
      }
    })

  ],

  outletDefs: [portlets.DspOutlet],

  init: function(frequency) {
    this.i(0).message(frequency)
  },

  process: function(inData, outData) {
    this.sine.process(outData[0])
  },

  start: function() {
    this.sine = new audiokit.Nodes.Sine({
      sampleRate: this.patch.sampleRate,
      blockSize: this.patch.blockSize,
      parameters: {frequency: 440}
    })
  },

  stop: function() {}

})

exports['dac~'] = PdObject.extend({

  inletDefs: [portlets.DspInlet, portlets.DspInlet],

  init: function(args) {
  },

  process: function(inData, outData) {
  },

  start: function() {
    this.audioDriver.start()
  },

  stop: function() {
    this.audioDriver.stop()
  }

})

}
