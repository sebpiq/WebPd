/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , utils = require('./core/utils')
  , mixins = require('./core/mixins')
  , PdObject = require('./core/PdObject')
  , Patch = require('./core/Patch')
  , pdGlob = require('./global')
  , portlets = require('./waa/portlets')


exports.declareObjects = function(library) {

  var _BaseControl = PdObject.extend({

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          this.obj._onMessageReceived(args)
        }
      })
    ],
    outletDefs: [portlets.Outlet],

    init: function(receiveName, sendName, pdInit, defaultValue, initialValue) {
      this._eventReceiver = new mixins.EventReceiver()

      // Assign initial value
      if (pdInit)
        this.value = initialValue
      else this.value = defaultValue

      if (receiveName && receiveName !== '-' && receiveName !== 'empty') {
        this.receiveName = receiveName
        // ! because the extend method instantiates the object for inheritance, 
        // we need this "if"
        if (this._onMessageReceived) {
          this._onMessageReceived = this._onMessageReceived.bind(this)
          this._eventReceiver.on(pdGlob.emitter, 'msg:' + this.receiveName, this._onMessageReceived)
        }
      }

      if (sendName && sendName !== '-' && sendName !== 'empty')
        this.sendName = sendName

      // !!! here we must test for patch because of extend which instantiates an object
      if (pdInit && this.patch) {
        var self = this
        this._onPatchStarted = function() { self._sendMessage([self.value]) }
        this._eventReceiver.on(this.patch, 'started', this._onPatchStarted)
      }
    },

    destroy: function() {
      this._eventReceiver.destroy()
    },

    _sendMessage: function(args) {
      this.o(0).message(args)
      if (this.sendName) 
        pdGlob.emitter.emit('msg:' + this.sendName, args)
    }

  })

  
  library['symbolatom'] = _BaseControl.extend({
    
    type: 'symbolatom',

    init: function(args) {
      var minValue = args[0] || undefined
        , maxValue = args[1] || undefined
        , receiveName = args[2]
        , sendName = args[3]
      _BaseControl.prototype.init.apply(this, [receiveName, sendName, 0, 'symbol', 0])
    },

    _onMessageReceived: function(args) {
      var value = args[0]
      if (value === 'bang' || _.isNumber(value) || value === 'symbol') {
        if (_.isNumber(value)) this.value = 'float'
        else if (value === 'symbol') this.value = args[1]
        this._sendMessage(utils.timeTag(['symbol', this.value], args))
      } else return console.error('invalid ' + value)
    }

  })


  var _BaseNumber = _BaseControl.extend({

    init: function(pdInit, receiveName, sendName, minValue, maxValue, initialValue) {
      this._limitInput = function(value) {
        if (_.isNumber(maxValue)) value = Math.min(value, maxValue)
        if (_.isNumber(minValue)) value = Math.max(value, minValue)
        return value
      }
      _BaseControl.prototype.init.apply(this, [receiveName, sendName, pdInit, 0, initialValue])
    },

    _onMessageReceived: function(args) {
      var value = args[0]
      if (value === 'bang' || _.isNumber(value)) {
        if (_.isNumber(value)) this.value = value
        this._sendMessage(utils.timeTag([this._limitInput(this.value)], args))
      } else return console.error('invalid ' + value)
    }

  })


  library['floatatom'] = _BaseNumber.extend({
    
    type: 'floatatom',

    init: function(args) {
      var minValue = args[0] || undefined
        , maxValue = args[1] || undefined
        , receiveName = args[2]
        , sendName = args[3]
      _BaseNumber.prototype.init.apply(this, [0, receiveName, sendName, minValue, maxValue, 0])
    }

  })


  library['nbx'] = _BaseNumber.extend({

    type: 'nbx',

    init: function(args) {
      var minValue = args[0] || undefined
        , maxValue = args[1] || undefined
        , pdInit = args[2] || 0
        , receiveName = args[3]
        , sendName = args[4]
        , initialValue = args[5] || 0
      _BaseNumber.prototype.init.apply(this, 
        [pdInit, receiveName, sendName, minValue, maxValue, initialValue])
    }

  })


  library['bng'] = _BaseControl.extend({

    type: 'bng',

    init: function(args) {
      var pdInit = args[0] || 0
        , receiveName = args[1]
        , sendName = args[2]
      _BaseControl.prototype.init.apply(this, [receiveName, sendName, pdInit, 'bang', 'bang'])
    },

    _onMessageReceived: function(args) {
      this._sendMessage(utils.timeTag(['bang'], args))
    }

  })


  library['tgl'] = _BaseControl.extend({

    type: 'tgl',

    init: function(args) {
      var pdInit = args[0] || 0
        , receiveName = args[1]
        , sendName = args[2]
        , initialValue = args[3] || 0
        , nonZeroValue = _.isNumber(args[4]) ? args[4] : 1
      _BaseControl.prototype.init.apply(this, [receiveName, sendName, pdInit, 0, initialValue])
      this.nonZeroValue = nonZeroValue
    },

    _onMessageReceived: function(args) {
      var value = args[0]
      if (value === 'bang') {
        if (this.value === 0) this.value = this.nonZeroValue
        else this.value = 0
        this._sendMessage(utils.timeTag([this.value], args))
      } else if (_.isNumber(value)) {
        if (value === 0) this.value = 0
        else this.value = this.nonZeroValue
        this._sendMessage(utils.timeTag([value], args))
      } else return console.error('invalid message received ' + args)
      
    }

  })


  var _BaseSlider = _BaseNumber.extend({

    init: function(args) {
      var minValue = args[0] || 0
        , maxValue = _.isNumber(args[1]) ? args[1] : 127
        , pdInit = args[2] || 0
        , receiveName = args[3]
        , sendName = args[4]
        , initialValue = args[5] || 0
      _BaseNumber.prototype.init.apply(this, 
        [pdInit, receiveName, sendName, minValue, maxValue, initialValue])
    }

  })

  library['hsl'] = _BaseSlider.extend({
    type: 'hsl'
  })


  library['vsl'] = _BaseSlider.extend({
    type: 'vsl'
  })


  var _BaseRadio = _BaseControl.extend({

    init: function(args) {
      var oldNew = args[0]
        , pdInit = args[1]
        , number = _.isNumber(args[2]) ? args[2] : 8
        , receiveName = args[3]
        , sendName = args[4]
        , initialValue = args[5] || 0
      this._limitInput = function(value) { return Math.floor(Math.min(Math.max(value, 0), number - 1)) }
      _BaseControl.prototype.init.apply(this, [receiveName, sendName, pdInit, 0, initialValue])
    },

    _onMessageReceived: function(args) {
      var value = args[0]
      if (value === 'bang' || _.isNumber(value)) {
        if (_.isNumber(value)) this.value = value
        this._sendMessage(utils.timeTag([this._limitInput(this.value)], args))
      } else return console.error('invalid ' + value)
    }

  })

  library['hradio'] = _BaseRadio.extend({
    type: 'hradio'
  })

  library['vradio'] = _BaseRadio.extend({
    type: 'vradio'
  })


  library['vu'] = _BaseControl.extend({

    init: function(args) {
      var receiveName = args[0]
      _BaseControl.prototype.init.apply(this, [receiveName, undefined, 0, 0, 0])
    },

    _onMessageReceived: function(args) {
      this._sendMessage(args)
    }

  })
}