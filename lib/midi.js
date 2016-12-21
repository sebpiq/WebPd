/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>, Jacob Stern <jacob.stern@outlook.com>
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
  , utils = require('./core/utils')
  , mixins = require('./core/mixins')
  , PdObject = require('./core/PdObject')
  , pdGlob = require('./global')
  , portlets = require('./waa/portlets')

exports.declareObjects = function(library) {

  library['notein'] = PdObject.extend({

    type: 'notein',

    inletDefs: [],

    outletDefs: [portlets.Outlet, portlets.Outlet, portlets.Outlet],

    init: function(args) {
      this._eventReceiver = new mixins.EventReceiver()
      this._eventReceiver.on(pdGlob.emitter, 'midiMessage', this._onMidiMessage.bind(this))
      this._channel = args[0]
    },

    _onMidiMessage: function(midiMessage) {
      var data = midiMessage.data
        , event = data[0] >> 4
      // Respond to note on and note off events
      if (event === 8 || event === 9) {
        var channel = (data[0] & 0x0F) + 1
          , note = data[1]
          , velocity = data[2]
        if (typeof this._channel === 'number') {
          if (channel === this._channel) {
            this.o(1).message([velocity])
            this.o(0).message([note])
          }
        } else {
          this.o(2).message([channel])
          this.o(1).message([velocity])
          this.o(0).message([note])
        }
      }
    },

    destroy: function() {
      this._eventReceiver.destroy()
    }
  })

  library['poly'] = PdObject.extend({

    type: 'poly',

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (val === 'stop') {
            this.obj._stop()
            return
          }
          if (val === 'clear') {
            this.obj._clear()
            return
          }
          if (!_.isNumber(val))
            return console.error('invalid [poly] value: ' + val)
          var velocityArg = args[1]
          if (_.isNumber(velocityArg))
            this.obj._vel = velocityArg
          this.obj._onFloat(args)
        }
      }),

      portlets.Inlet.extend({
        message: function(args) {
          var val = args[0]
          if (!_.isNumber(val))
            return console.error('invalid [poly] value: ' + val)
          this.obj._vel = val
        }
      })
    ],

    outletDefs: [portlets.Outlet, portlets.Outlet, portlets.Outlet],

    init: function(args) {
      this._n = args[0] >= 1 ? args[0] : 1
      this._steal = args[1] === 1
      this._vel = 0
      this._resetMemory()
    },

    _onFloat: function(args) {
      // Translated from https://github.com/pure-data/pure-data/blob/master/src/x_midi.c
      var val = args[0]
        , firstOn = null
        , firstOff = null
        , onIndex = 0
        , offIndex = 0
      if (this._vel > 0) {
        var serialOn = Number.MAX_VALUE
          , serialOff = Number.MAX_VALUE
        this._vec.forEach(function(v, i) {
          if (v.used && v.serial < serialOn) {
            firstOn = v;
            serialOn = v.serial;
            onIndex = i;
          } else if (!v.used && v.serial < serialOff) {
            firstOff = v;
            serialOff = v.serial;
            offIndex = i;
          }
        })
        if (firstOff) {
          this._message(2, this._vel, args)
          this._message(1, val, args)
          this._message(0, offIndex + 1, args)
          firstOff.pitch = val
          firstOff.used = true
          firstOff.serial = this._serial++
        } else if (firstOn && this._steal) {
          // If no available voice, steal one
          this._message(2, 0, args)
          this._message(1, firstOn.pitch, args)
          this._message(0, onIndex + 1, args)
          this._message(2, this._vel, args)
          this._message(1, val, args)
          this._message(0, onIndex + 1, args)
          firstOn.pitch = val
          firstOn.serial = this._serial++
        }
      } else {
        // Note off, turn off oldest match
        var serialOn = Number.MAX_VALUE
        this._vec.forEach(function(v, i) {
          if (v.used && v.pitch === val && v.serial < serialOn) {
            firstOn = v
            serialOn = v.serial
            onIndex = i
          }
        })
        if (firstOn) {
          firstOn.used = 0
          firstOn.serial = this._serial++
          this._message(2, 0, args)
          this._message(1, firstOn.pitch, args)
          this._message(0, onIndex + 1, args)
        }
      }
    },

    _stop: function(args) {
      var self = this
      this._vec.forEach(function(v, i) {
        if (v.used) {
          self._message(2, 0, args)
          self._message(1, v.pitch, args)
          self._message(0, i + 1, args)
        }
      })
      this._resetMemory()
    },

    _clear: function(args) {
      this._resetMemory()
    },

    _resetMemory: function() {
      this._vec = []
      this._serial = 0
      for (var i = 0; i < this._n; i++) {
        this._vec.push({
          pitch: 0,
          used: false,
          serial: 0
        })
      }
    },

    _message: function(index, value, args) {
      this.o(index).message(utils.timeTag([value], args))
    }
  })
}