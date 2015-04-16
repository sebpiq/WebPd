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

var EventEmitter = require('events').EventEmitter
  , _ = require('underscore')
  , expect = require('chai').expect
  , WAAOffset = require('waaoffsetnode')
  , WAAWhiteNoise = require('waawhitenoisenode')
  , WAATableNode = require('waatablenode')
  , utils = require('../core/utils')
  , mixins = require('../core/mixins')
  , PdObject = require('../core/PdObject')
  , portlets = require('./portlets')
  , pdGlob = require('../global')

exports.declareObjects = function(library) {

  var _OscBase = PdObject.extend({

    inletDefs: [

      portlets.DspInlet.extend({
        message: function(args) {
          var frequency = args[0]
          if (!this.hasDspSource()) {
            expect(frequency).to.be.a('number', this.obj.type + '::frequency')
            if (frequency === Infinity) frequency = 0
            this.obj.frequency = frequency
            this.obj._updateFrequency()
          }
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var phase = args[0]
          expect(phase).to.be.a('number', 'osc~::phase')
          this.obj._updatePhase(phase)
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
      this._destroyOscillator()
    },

    _updateFrequency: function() {
      if (this._oscNode)
        this._oscNode.frequency.setValueAtTime(this.frequency, pdGlob.futureTime / 1000 || 0)
    },

    _updatePhase: function(phase) {
      if (pdGlob.isStarted)
        this._createOscillator(phase)
    }

  })


  // TODO : When phase is set, the current oscillator will be immediately disconnected,
  // while ideally, it should be disconnected only at `futureTime` 
  library['osc~'] = _OscBase.extend({

    type: 'osc~',

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
    },

    _destroyOscillator: function() {
      this._oscNode.stop(0)
      this._oscNode = null
    }

  })


  library['phasor~'] = _OscBase.extend({

    type: 'phasor~',

    _createOscillator: function(phase) {
      this._gainNode = pdGlob.audio.context.createGain()
      this._gainNode.gain.value = 0.5

      this._oscNode = pdGlob.audio.context.createOscillator()
      this._oscNode.type = 'sawtooth'
      this._oscNode.start(pdGlob.futureTime / 1000 || 0)
      this._oscNode.connect(this._gainNode)
      
      this._offsetNode = new WAAOffset(pdGlob.audio.context)
      this._offsetNode.offset.value = 1
      this._offsetNode.connect(this._gainNode)

      this.o(0).setWaa(this._gainNode, 0)
      this.i(0).setWaa(this._oscNode.frequency, 0)
      this.i(0).message([this.frequency])
    },

    _destroyOscillator: function() {
      this._oscNode.stop(0)
      this._oscNode = null
      this._gainNode = null
      this._offsetNode = null
    }

  })


  library['triangle~'] = _OscBase.extend({

    type: 'triangle~',

    _createOscillator: function(phase) {
      this._oscNode = pdGlob.audio.context.createOscillator()
      this._oscNode.type = 'triangle'
      this._oscNode.start(pdGlob.futureTime / 1000 || 0)
      this.o(0).setWaa(this._oscNode, 0)
      this.i(0).setWaa(this._oscNode.frequency, 0)
      this.i(0).message([this.frequency])
    },

    _destroyOscillator: function() {
      this._oscNode.stop(0)
      this._oscNode = null
    }

  })


  library['square~'] = _OscBase.extend({

    type: 'square~',

    _createOscillator: function(phase) {
      this._oscNode = pdGlob.audio.context.createOscillator()
      this._oscNode.type = 'square'
      this._oscNode.start(pdGlob.futureTime / 1000 || 0)
      this.o(0).setWaa(this._oscNode, 0)
      this.i(0).setWaa(this._oscNode.frequency, 0)
      this.i(0).message([this.frequency])
    },

    _destroyOscillator: function() {
      this._oscNode.stop(0)
      this._oscNode = null
    }

  })


  // NB : This should work, but for now it doesn't seem to.
  // issues filed for chrome here : https://code.google.com/p/chromium/issues/detail?id=471675
  // and firefox here : https://bugzilla.mozilla.org/show_bug.cgi?id=1149053

  // Another possible technique would be to use 2 WaveShaperNodes one with the sign function, 
  // The other with acos.

  // TODO : When phase is set, the current oscillator will be immediately disconnected,
  // while ideally, it should be disconnected only at `futureTime`
  // TODO: phase
  /*library['phasor~'] = _OscBase.extend({

    type: 'phasor~',

    start: function() {
      this._createOscillator(0)
    },

    stop: function() {
      this._bufferSource.stop(0)
      this._bufferSource = null
    },

    _createOscillator: function(phase) {
      var sampleRate = pdGlob.audio.context.sampleRate
        , buffer = pdGlob.audio.context.createBuffer(1, sampleRate, sampleRate)
        , array = buffer.getChannelData(0)
        , acc = phase, step = 1 / sampleRate, i

      for (i = 0; i < sampleRate; i++) {
        array[i] = (acc % 1)
        acc += step
      }

      this._bufferSource = pdGlob.audio.context.createBufferSource()
      this._bufferSource.buffer = buffer
      this._bufferSource.loop = true
      this._bufferSource.start(pdGlob.futureTime / 1000 || 0)
      
      this.o(0).setWaa(this._bufferSource, 0)
      this.i(0).setWaa(this._bufferSource.playbackRate, 0)
      this.i(0).message([this.frequency])
    },

    _updateFrequency: function() {
      if (this._bufferSource)
        this._bufferSource.playbackRate.setValueAtTime(this.frequency, pdGlob.futureTime / 1000 || 0)
    },

    _updatePhase: function(phase) {
      if (pdGlob.isStarted)
        this._createOscillator(phase)
    }

  })*/


  library['noise~'] = PdObject.extend({

    type: 'noise~',

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

  // TODO : doesn't work when interrupting a line (probably)
  library['line~'] = PdObject.extend({

    type: 'line~',

    inletDefs: [

      portlets.Inlet.extend({

        init: function() {
          this._queue = []
          this._lastValue = 0
        },

        message: function(args) {
          var self = this
          if (this.obj._offsetNode) {
            var v2 = args[0]
              , t1 = (pdGlob.futureTime || pdGlob.audio.time)
              , duration = args[1] || 0

            // Deal with arguments
            expect(v2).to.be.a('number', 'line~::target')
            if (duration)
              expect(duration).to.be.a('number', 'line~::duration')

            // Refresh the queue to current time and push the new line
            this._refreshQueue(pdGlob.audio.time)
            var newLines = this._pushToQueue(t1, v2, duration)

            // Cancel everything that was after the new lines, and schedule them
            this.obj._offsetNode.offset.cancelScheduledValues(newLines[0].t1 / 1000 + 0.000001)
            newLines.forEach(function(line) {
              if (line.t1 !== line.t2)
                self.obj._offsetNode.offset.linearRampToValueAtTime(line.v2, line.t2 / 1000)
              else
                self.obj._offsetNode.offset.setValueAtTime(line.v2, line.t2 / 1000)
            })
          }
        },

        _interpolate: function(line, time) {
          return (time - line.t1) * (line.v2 - line.v1) / (line.t2 - line.t1) + line.v1
        },

        // Refresh the queue to `time`, removing old lines and setting `_lastValue`
        // if appropriate.
        _refreshQueue: function(time) {
          if (this._queue.length === 0) return
          var i = 0, line, oldLines
          while ((line = this._queue[i++]) && time >= line.t2) 1
          oldLines = this._queue.slice(0, i - 1)
          this._queue = this._queue.slice(i - 1)
          if (this._queue.length === 0)
            this._lastValue = oldLines[oldLines.length - 1].v2
        },

        // push a line to the queue, overriding the lines that were after it,
        // and creating new lines if interrupting something in its middle.
        _pushToQueue: function(t1, v2, duration) {
          var i = 0, line, newLines = []
          
          // Find the point in the queue where we should insert the new line.
          while ((line = this._queue[i++]) && (t1 >= line.t2)) 1
          this._queue = this._queue.slice(0)

          if (this._queue.length) {
            var lastLine = this._queue[this._queue.length - 1]

            // If the new line interrupts the last in the queue, we have to interpolate
            // a new line
            if (t1 < lastLine.t2) {
              this._queue = this._queue.slice(0, -1)
              line = {
                t1: lastLine.t1, v1: lastLine.v1,
                t2: t1, v2: this._interpolate(lastLine, t1)
              }
              newLines.push(line)
              this._queue.push(line)

            // Otherwise, we have to fill-in the gap with a straight line
            } else if (t1 > lastLine.t2) {
              line = {
                t1: lastLine.t2, v1: lastLine.v2,
                t2: t1, v2: lastLine.v2
              }
              newLines.push(line)
              this._queue.push(line)
            }

          // If there isn't any value in the queue yet, we fill in the gap with
          // a straight line from `_lastValue` all the way to `t1` 
          } else {
            line = {
              t1: 0, v1: this._lastValue,
              t2: t1, v2: this._lastValue
            }
            newLines.push(line)
            this._queue.push(line)
          }

          // Finally create the line and add it to the queue
          line = {
            t1: t1, v1: this._queue[this._queue.length - 1].v2,
            t2: t1 + duration, v2: v2
          }
          newLines.push(line)
          this._queue.push(line)
          return newLines
        }

      })

    ],

    outletDefs: [portlets.DspOutlet],

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
    type: '*~',

    inletDefs: [

      portlets.DspInlet,

      portlets.DspInlet.extend(_DspArithmValInletMixin, {
        _setValNoDsp: function(val) {
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
    type: '+~',

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
    type: '-~',

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

  // Baseclass for tabwrite~, tabread~ and others ...
  var _TabBase = PdObject.extend({

    init: function(args) {
      var self = this
      this.array = new mixins.Reference('array')
      this._onDataChangedHandler = null

      // When name of the referenced array is changing, we need to detach handlers
      this.array.on('changed', function(newArray, oldArray) {
        if (oldArray) oldArray.removeListener('changed:data', self._onDataChangedHandler)
        if (newArray) {
          self._onDataChangedHandler = function() { self.dataChanged() }
          newArray.on('changed:data', self._onDataChangedHandler)
        }
      })
    },

    dataChanged: function() {},

    destroy: function() {
      if (this.array.resolved)
        this.array.resolved.removeListener('changed:data', this._onDataChangedHandler)
      this.array.destroy()
    }

  })

  // TODO: tabread4~
  // TODO: when array's data changes, this should update the node
  library['tabread~'] = library['tabread4~'] = _TabBase.extend({
    type: 'tabread~',

    inletDefs: [
      portlets.DspInlet.extend({
        
        message: function(args) {
          var method = args[0]
          if (method === 'set')
            this.obj.array.set(args[1])
          else
            console.error('unknown method ' + method)
        },

        connection: function() {
          portlets.DspInlet.prototype.connection.apply(this, arguments)
          this.obj._updateDsp()
        },

        disconnection: function() {
          portlets.DspInlet.prototype.disconnection.apply(this, arguments)
          this.obj._updateDsp()
        }

      })
    ],

    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      var self = this
        , arrayName = args[0]
      _TabBase.prototype.init.apply(this, arguments)
      this.array.on('changed', function() { self._updateDsp() })
      if (arrayName) this.array.set(arrayName)
    },

    start: function() {
      this._tableNode = new WAATableNode(pdGlob.audio.context)
      this._gainNode = pdGlob.audio.context.createGain()
      this.i(0).setWaa(this._tableNode.position, 0)
      this.o(0).setWaa(this._gainNode, 0)
      this._updateDsp()
    },

    stop: function() {
      this._tableNode = null
      this._gainNode = null
    },

    destroy: function() {
      _TabBase.prototype.destroy.apply(this, arguments)
    },

    dataChanged: function() {
      if (this._tableNode) this._tableNode.table = this.array.resolved.data
    },

    _updateDsp: function() {
      if (this._tableNode && this.array.resolved && this.i(0).hasDspSource()) {
        this._tableNode.table = this.array.resolved.data
        this._tableNode.connect(this._gainNode)
      } else if (this._tableNode) {
        this._tableNode.disconnect()
      }
    }

  })

  library['delwrite~'] = PdObject.extend(mixins.NamedMixin, EventEmitter.prototype, {

    type: 'delwrite~',

    inletDefs: [portlets.DspInlet],

    init: function(args) {
      var name = args[0]
        , maxDelayTime = args[1]
      this.maxDelayTime = maxDelayTime || 1000
      if (name) this.setName(name)
    },

    start: function() {
      this._pipeNode = pdGlob.audio.context.createGain()
      this.i(0).setWaa(this._pipeNode, 0)
      this.emit('started')
    },

    stop: function() {
      this._pipeNode.disconnect()
      this._pipeNode = null
    },

    destroy: function() {
      mixins.NamedMixin.destroy.apply(this, arguments)
      this.removeAllListeners()
    }

  })

  library['delread~'] = library['vd~'] = PdObject.extend({

    type: 'delread~',

    inletDefs: [
      portlets.DspInlet.extend({
        message: function(args) {
          var delayTime = args[0]
          this.obj.setDelayTime(delayTime)
        }
      })
    ],
    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      var self = this
        , delayName = args[0]
        , initialDelayTime = args[1]
      this._delayTime = initialDelayTime || 0
      this._delWrite = new mixins.Reference('delwrite~')
      this._onDelWriteStarted = null
      if (delayName) this._delWrite.set(delayName)
    },

    start: function() {
      this._createDelay()
      this._onDelWriteChanged = function(newObj, oldObj) {
        if (pdGlob.isStarted && newObj) self._createDelay()
      }
      this._delWrite.on('changed', this._onDelWriteChanged)
    },

    stop: function() {
      this._toSecondsGain = null
      this._delayNode.disconnect()
      this._delayNode = null
      this._delWrite.removeListener('changed', this._onDelWriteChanged)
      this._onDelWriteChanged = null
    },

    destroy: function() {
      this._delWrite.destroy()
      if (this._delWrite.resolved && this._onDelWriteStarted)
        this._delWrite.resolved.removeListener('started', this._onDelWriteStarted)
    },

    setDelayTime: function(delayTime) {
      expect(delayTime).to.be.a('number')
      this._delayTime = delayTime
      if (this._delayNode && !this.i(0).hasDspSource())
        this._delayNode.delayTime.setValueAtTime(this._delayTime / 1000, pdGlob.futureTime / 1000 || 0)
    },

    _createDelay: function() {
      if (this._delayNode) this._delayNode.disconnect()
      var maxDelayTime = this._delWrite.resolved ? this._delWrite.resolved.maxDelayTime / 1000 : 1
        , self = this
      this._delayNode = pdGlob.audio.context.createDelay(maxDelayTime)

      if (!this._toSecondsGain) {
        this._toSecondsGain = pdGlob.audio.context.createGain()
        this._toSecondsGain.gain.value = 0.001
        this.i(0).setWaa(this._toSecondsGain, 0)
      }

      this._toSecondsGain.connect(this._delayNode.delayTime)
      this.o(0).setWaa(this._delayNode, 0)
      this.setDelayTime(this._delayTime)
      if (this._delWrite.resolved) {
        var doConnection = function() { self._delWrite.resolved._pipeNode.connect(self._delayNode) }
        if (this._delWrite.resolved._pipeNode)
          doConnection()
        else {
          this._onDelWriteStarted = doConnection
          this._delWrite.resolved.once('started', this._onDelWriteStarted)
        }
      }
        
    }

  })


  // TODO : should change curve in the future
  library['clip~'] = PdObject.extend({

    type: 'clip~',

    inletDefs: [

      portlets.DspInlet,

      portlets.Inlet.extend({
        message: function(args) {
          var minValue = args[0]
          expect(minValue).to.be.a('number', 'clip~::min')
          this.obj.minValue = minValue
          this.obj._updateGains()
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var maxValue = args[0]
          expect(maxValue).to.be.a('number', 'clip~::max')
          this.obj.maxValue = maxValue
          this.obj._updateGains()
        }
      })

    ],

    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      this.minValue = args[0] || 0
      this.maxValue = args[1] || 0
    },

    start: function() {
      this._gainInNode = pdGlob.audio.context.createGain()
      this._gainOutNode = pdGlob.audio.context.createGain()
      this._waveShaperNode = pdGlob.audio.context.createWaveShaper()

      this._gainInNode.connect(this._waveShaperNode)
      //this._waveShaperNode.connect(this._gainOutNode)
      
      this.i(0).setWaa(this._gainInNode, 0)
      //this.o(0).setWaa(this._gainOutNode, 0)
      this.o(0).setWaa(this._waveShaperNode, 0)

      this._updateGains()
    },

    stop: function() {
      this._gainInNode = null
      this._waveShaperNode = null
      this._gainOutNode.disconnect()
      this._gainOutNode = null
    },

    _updateGains: function() {
      if (this._waveShaperNode) {
        var bound = Math.max(Math.abs(this.minValue), Math.abs(this.maxValue))
          , sampleRate = Pd.getSampleRate()
          , curve = new Float32Array(sampleRate)
          , i, acc = -bound, k = bound * 2 / sampleRate
        for (i = 0; i < sampleRate; i++) {
          if (acc >= this.minValue && acc <= this.maxValue) curve[i] = acc
          else if (acc > this.maxValue) curve[i] = this.maxValue
          else curve[i] = this.minValue
          acc += k
        }
        this._waveShaperNode.curve = curve
        this._gainInNode.gain.setValueAtTime(bound !== 0 ? 1 / bound : 0, 0)
        //this._gainOutNode.gain.setValueAtTime(bound, 0)
      }
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
