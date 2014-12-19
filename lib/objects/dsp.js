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

exports.declareObjects = function(exports) {

// TODO: dsp signal to first inlet
// TODO: phase
exports['osc~'] = PdObject.extend({

  inletDefs: [

    portlets.Inlet.extend({
      message: function(frequency) {
        expect(frequency).to.be.a('number', 'osc~::frequency')
        this.obj.frequency = frequency
        if (this.obj._oscNode)
          this.obj._oscNode.frequency.setValueAtTime(frequency, 0)
      }
    })

  ],

  outletDefs: [portlets.DspOutlet],

  init: function(frequency) {
    this.frequency = frequency || 0
  },

  start: function() {
    this._oscNode = pdGlob.audio.context.createOscillator()
    this._oscNode.start(0)
    this.o(0).waa = { node: this._oscNode, output: 0 }
    this.i(0).message(this.frequency)
  },

  stop: function() {
    this._oscNode.stop(0)
    this._oscNode = null
  }

})

exports['dac~'] = PdObject.extend({

  endPoint: true,

  inletDefs: [portlets.DspInlet, portlets.DspInlet],

  start: function() {
    this._channelMerger = pdGlob.audio.context.createChannelMerger(pdGlob.settings.channelCount)
    this._channelMerger.connect(pdGlob.audio.context.destination)
    this._gainLeft = pdGlob.audio.context.createGain()
    this._gainRight = pdGlob.audio.context.createGain()
    this._gainLeft.connect(this._channelMerger, 0, 0)
    this._gainRight.connect(this._channelMerger, 0, 1)
    this.i(0).waa = { node: this._gainLeft, input: 0 }
    this.i(1).waa = { node: this._gainRight, input: 1 }
  }

})

}
