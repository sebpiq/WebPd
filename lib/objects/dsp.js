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

exports.declareObjects = function(library) {

  // TODO: phase
  library['osc~'] = PdObject.extend({

    type: 'osc~',

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
          expect(phase).to.be.a('number', 'osc~::phase')
          if (pdGlob.isStarted)
            this.obj._createOscillator(phase)
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
      phase = phase * 2 * Math.PI 
      this._oscNode = pdGlob.audio.context.createOscillator()
      this._oscNode.setPeriodicWave(pdGlob.audio.context.createPeriodicWave(
        new Float32Array([0, Math.cos(phase)]),
        new Float32Array([0, Math.sin(-phase)])
      ))
      this._oscNode.start(0)
      this.o(0).setWaa(this._oscNode, 0)
      this.i(0).setWaa(this._oscNode.frequency, 0)
      this.i(0).message(this.frequency)
    }

  })


  library['line~'] = PdObject.extend({

    type: 'line~',

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
      this.o(0).setWaa(this._offsetNode, 0)
    },

    stop: function() {
      this._offsetNode = null
    }

  })


  library['dac~'] = PdObject.extend({

    type: 'dac~',

    endPoint: true,

    inletDefs: [portlets.DspInlet, portlets.DspInlet],

    start: function() {
      this.i(0).setWaa(pdGlob.audio.channels[0], 0)
      this.i(1).setWaa(pdGlob.audio.channels[1], 1)
    }

  })

}
