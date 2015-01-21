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
  , WAAWhiteNoise = require('waawhitenoise')
  , utils = require('../core/utils')
  , PdObject = require('../core/PdObject')
  , portlets = require('./portlets')
  , pdGlob = require('../global')

exports.declareObjects = function(library) {

  // TODO : When phase is set, the current oscillator will be immediately disconnected,
  // while ideally, it should be disconnected only at `futureTime` 
  library['osc~'] = PdObject.extend({

    type: 'osc~',

    inletDefs: [

      portlets.DspInlet.extend({
        message: function(args) {
          var frequency = args[0]
          if (!this.hasDspSource()) {
            expect(frequency).to.be.a('number', 'osc~::frequency')
            this.obj.frequency = frequency
            if (this.obj._oscNode)
              this.obj._oscNode.frequency.setValueAtTime(frequency, pdGlob.futureTime / 1000 || 0)
          }
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var phase = args[0]
          expect(phase).to.be.a('number', 'osc~::phase')
          if (pdGlob.isStarted)
            this.obj._createOscillator(phase)
        }
      })

    ],

    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      this.frequency = args[0] || 0
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
      this._oscNode.start(pdGlob.futureTime / 1000 || 0)
      this.o(0).setWaa(this._oscNode, 0)
      this.i(0).setWaa(this._oscNode.frequency, 0)
      this.i(0).message([this.frequency])
    }

  })

  library['noise~'] = PdObject.extend({

    outletDefs: [portlets.DspOutlet],

    start: function() {
      this._noiseNode = new WAAWhiteNoise(pdGlob.audio.context)
      this._noiseNode.start(0)
      this.o(0).setWaa(this._noiseNode, 0)
    },

    stop: function() {
      this._noiseNode.stop(0)
      this._noiseNode.disconnect()
      this._noiseNode = null
    }

  })

  // TODO : doesn't work when interrupting a line
  library['line~'] = PdObject.extend({

    type: 'line~',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var value = args[0]
            , time = args[1]

          if (this.obj._offsetNode) {
            expect(value).to.be.a('number', 'line~::value')
            if (time) {
              expect(time).to.be.a('number', 'line~::time')
              var endTime = (pdGlob.futureTime / 1000 || pdGlob.audio.time / 1000) + time / 1000
              this.obj._offsetNode.offset.setValueAtTime(this.obj.target, pdGlob.futureTime / 1000 || 0)
              this.obj._offsetNode.offset.linearRampToValueAtTime(value, endTime)
            } else
              this.obj._offsetNode.offset.setValueAtTime(value, pdGlob.futureTime / 1000 || 0)
          }
          this.obj.target = value
        }
      })

    ],

    outletDefs: [portlets.DspOutlet],

    init: function() {
      this.target = 0
    },

    start: function() {
      this._offsetNode = new WAAOffset(pdGlob.audio.context)
      this._offsetNode.offset.setValueAtTime(0, 0)
      this.o(0).setWaa(this._offsetNode, 0)
    },

    stop: function() {
      this._offsetNode = null
    }

  })


  library['sig~'] = PdObject.extend({

    type: 'sig~',

    inletDefs: [

      portlets.Inlet.extend({
        message: function(args) {
          var value = args[0]
          expect(value).to.be.a('number', 'sig~::value')
          this.obj.value = value
          if (this.obj._offsetNode)
            this.obj._offsetNode.offset.setValueAtTime(value, pdGlob.futureTime / 1000 || 0)
        }
      })

    ],

    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      this.value = args[0] || 0
    },

    start: function() {
      this._offsetNode = new WAAOffset(pdGlob.audio.context)
      this._offsetNode.offset.setValueAtTime(0, 0)
      this.o(0).setWaa(this._offsetNode, 0)
      this.i(0).message([this.value])
    },

    stop: function() {
      this._offsetNode = null
    }

  })


  var _FilterFrequencyInletMixin = {
    message: function(args) {
      var frequency = args[0]
      expect(frequency).to.be.a('number', this.obj.type + '::frequency')
      this.obj.frequency = frequency
      if (this.obj._filterNode)
        this.obj._filterNode.frequency.setValueAtTime(frequency, pdGlob.futureTime / 1000 || 0)
    }
  }

  var _FilterQInletMixin = {
    message: function(args) {
      var Q = args[0]
      expect(Q).to.be.a('number', this.obj.type + '::Q')
      this.obj.Q = Q
      if (this.obj._filterNode)
        this.obj._filterNode.Q.setValueAtTime(Q, pdGlob.futureTime / 1000 || 0)
    }
  }

  var _BaseFilter = PdObject.extend({

    inletDefs: [portlets.DspInlet, portlets.Inlet.extend(_FilterFrequencyInletMixin)],
    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      this.frequency = args[0] || 0
    },

    start: function() {
      this._filterNode = pdGlob.audio.context.createBiquadFilter()
      this._filterNode.frequency.setValueAtTime(this.frequency, 0)
      this._filterNode.type = this.waaFilterType
      this.i(0).setWaa(this._filterNode, 0)
      this.o(0).setWaa(this._filterNode, 0)
      this.i(1).message([this.frequency])
    },

    stop: function() {
      this._filterNode = null
    }

  })

  var _BaseBandFilter = _BaseFilter.extend({
    waaFilterType: 'bandpass',

    init: function(args) {
      _BaseFilter.prototype.init.call(this, args)
      this.Q = args[1] || 1
    },

    start: function(args) {
      _BaseFilter.prototype.start.call(this, args)
      this._filterNode.Q.setValueAtTime(this.Q, 0)
      this.i(2).message([this.Q])
    }

  })


  // TODO: tests for filters
  library['lop~'] = _BaseFilter.extend({
    type: 'lop~',
    waaFilterType: 'lowpass'
  })


  library['hip~'] = _BaseFilter.extend({
    type: 'hip~',
    waaFilterType: 'highpass'
  })


  library['bp~'] = _BaseBandFilter.extend({
    type: 'bp~',

    inletDefs: [
      portlets.DspInlet,
      portlets.Inlet.extend(_FilterFrequencyInletMixin),
      portlets.Inlet.extend(_FilterQInletMixin)
    ]
  })


  library['vcf~'] = _BaseBandFilter.extend({
    type: 'vcf~',

    inletDefs: [
      portlets.DspInlet,
      portlets.DspInlet.extend(_FilterFrequencyInletMixin),
      portlets.Inlet.extend(_FilterQInletMixin)
    ],

    start: function(args) {
      _BaseBandFilter.prototype.start.call(this, args)
      this.i(1).setWaa(this._filterNode.frequency, 0)
    }

  })


  var _DspArithmBase = PdObject.extend({

    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      var val = args[0]
      this.setVal(val || 0)
    },

    setVal: function(val) {
      expect(val).to.be.a('number', this.type + '::val')
      this.val = val
    }

  })

  // Mixin for inlet 1 of Dsp arithmetics objects *~, +~, ...
  var _DspArithmValInletMixin = {
    
    message: function(args) {
      var val = args[0]
      this.obj.setVal(val)
      if (!this.hasDspSource()) this._setValNoDsp(val)
    },
    
    disconnection: function(outlet) {
      portlets.DspInlet.prototype.disconnection.apply(this, arguments) 
      if (outlet instanceof portlets.DspOutlet && !this.hasDspSource())
        this._setValNoDsp(this.obj.val)
    }
  }


  library['*~'] = _DspArithmBase.extend({

    inletDefs: [

      portlets.DspInlet,

      portlets.DspInlet.extend(_DspArithmValInletMixin, {
        _setValNoDsp: function(val) {
          console.log(pdGlob.futureTime)
          if (this.obj._gainNode)
            this.obj._gainNode.gain.setValueAtTime(val, pdGlob.futureTime / 1000 || 0)
        }
      })

    ],

    start: function() {
      this._gainNode = pdGlob.audio.context.createGain()
      this.i(0).setWaa(this._gainNode, 0)
      this.i(1).setWaa(this._gainNode.gain, 0)
      this.o(0).setWaa(this._gainNode, 0)
      if (!this.i(1).hasDspSource()) this.i(1)._setValNoDsp(this.val)
    },

    stop: function() {
      this._gainNode = null
    }

  })


  library['+~'] = _DspArithmBase.extend({

    inletDefs: [

      portlets.DspInlet,

      portlets.DspInlet.extend(_DspArithmValInletMixin, {
        _setValNoDsp: function(val) { 
          if (this.obj._offsetNode)
            this.obj._offsetNode.offset.setValueAtTime(val, pdGlob.futureTime / 1000 || 0)
        }
      })

    ],

    start: function() {
      this._offsetNode = new WAAOffset(pdGlob.audio.context)
      this._gainNode = pdGlob.audio.context.createGain()
      this._gainNode.gain.value = 1
      this._offsetNode.offset.value = 0
      this._offsetNode.connect(this._gainNode, 0, 0)
      this.i(0).setWaa(this._gainNode, 0)
      this.i(1).setWaa(this._offsetNode.offset, 0)
      this.o(0).setWaa(this._gainNode, 0)
      if (!this.i(1).hasDspSource()) this.i(1)._setValNoDsp(this.val)
    },

    stop: function() {
      this._offsetNode.disconnect()
      this._gainNode = null
      this._offsetNode = null
    }

  })


  library['-~'] = _DspArithmBase.extend({

    inletDefs: [

      portlets.DspInlet,

      portlets.DspInlet.extend(_DspArithmValInletMixin, {
        _setValNoDsp: function(val) { 
          if (this.obj._offsetNode)
            this.obj._offsetNode.offset.setValueAtTime(val, pdGlob.futureTime / 1000 || 0)
        }
      })

    ],

    start: function() {
      this._offsetNode = new WAAOffset(pdGlob.audio.context)
      this._gainNode = pdGlob.audio.context.createGain()
      this._negateGainNode = pdGlob.audio.context.createGain()
      this._gainNode.gain.value = 1
      this._negateGainNode.gain.value = -1
      this._offsetNode.offset.value = 0
      this._offsetNode.connect(this._negateGainNode, 0, 0)
      this._negateGainNode.connect(this._gainNode, 0, 0)
      this.i(0).setWaa(this._gainNode, 0)
      this.i(1).setWaa(this._offsetNode.offset, 0)
      this.o(0).setWaa(this._gainNode, 0)
      if (!this.i(1).hasDspSource()) this.i(1)._setValNoDsp(this.val)
    },

    stop: function() {
      this._negateGainNode.disconnect()
      this._offsetNode.disconnect()
      this._gainNode = null
      this._negateGainNode = null
      this._offsetNode = null
    }

  })


  library['dac~'] = PdObject.extend({

    type: 'dac~',

    endPoint: true,

    inletDefs: [portlets.DspInlet, portlets.DspInlet],

    start: function() {
      this.i(0).setWaa(pdGlob.audio.channels[0], 0)
      this.i(1).setWaa(pdGlob.audio.channels[1], 0)
    }

  })

}
