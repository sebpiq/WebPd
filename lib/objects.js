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
  , portlets = require('./portlets')
  , utils = require('./utils')
  , PdObject = require('./PdObject')
  , pdGlob = require('./global')
  , audiokit = require('audiokit')

/*
  // This caches the block fetched from the node. 
  this._cachedBlock = {time: -1, buffer: null}

  // Pulls the audio from the node only once, and copies it so that several
  // nodes downstream can pull the same block.
  _tick: function() {
    var self = this
    if (this._cachedBlock.time < this.context.currentTime) {
      var outBuffer = this.node._tick()
      if (self._numberOfChannels !== outBuffer.numberOfChannels) {
        self._numberOfChannels = outBuffer.numberOfChannels
        self.emit('_numberOfChannels')
      }
      self._cachedBlock = {time: self.context.currentTime, buffer: outBuffer}
      return outBuffer
    } else return this._cachedBlock.buffer
  }
*/

/**************************** dsp *********************************/
// TODO: dsp signal to first inlet
// TODO: phase
exports['osc~'] = PdObject.extend({

  inletDefs: [

    portlets['inlet'].extend({
      message: function(frequency) {
        expect(frequency).to.be.a('number', 'osc~::frequency')
        this.obj.frequency = frequency
      }
    })

  ],

  outletDefs: [portlets['outlet~']],

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

  inletDefs: [portlets['inlet~'], portlets['inlet~']],

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

/**************************** glue *********************************/
exports['receive'] = PdObject.extend(utils.NamedMixin, {

  outletDefs: [portlets['outlet']],
  abbreviations: ['r'],

  init: function(name) {
    var onMsgReceived = this._messageHandler()
    this.on('change:name', function(oldName, newName) {
      if (oldName) pdGlob.emitter.removeListener('msg:' + oldName, onMsgReceived)
      pdGlob.emitter.on('msg:' + newName, onMsgReceived)
    })
    this.setName(name)
  },

  _messageHandler: function() {
    var self = this
    return function() {
      var outlet = self.outlets[0]
      outlet.message.apply(outlet, arguments)
    }
  }

})

exports['send'] = PdObject.extend(utils.NamedMixin, {

  inletDefs: [

    portlets['inlet'].extend({
      message: function() {
        pdGlob.emitter.emit.apply(pdGlob.emitter, ['msg:' + this.obj.name].concat(_.toArray(arguments)))
      }
    })

  ],

  abbreviations: ['s'],

  init: function(name) { this.setName(name) }

})

exports['msg'] = PdObject.extend({

  doResolveArgs: false,

  inletDefs: [

    portlets['inlet'].extend({
      message: function() {
        var outlet = this.obj.outlets[0]
          , msg = _.toArray(arguments)
        // For some reason in Pd $0 in a message is always 0.
        msg.unshift(0)
        outlet.message.apply(outlet, this.obj.resolver(msg))
      }
    })

  ],

  outletDefs: [portlets['outlet']],

  init: function() {
    this.resolver = this.getDollarResolver(_.toArray(arguments))
  }

})

exports['print'] = PdObject.extend({

  inletDefs: [

    portlets['inlet'].extend({
      message: function() {
        msg = _.toArray(arguments)
        console.log.apply(console, this.obj.prefix ? [this.obj.prefix].conct(msg) : msg)
      }
    })

  ],

  init: function(prefix) {
    this.prefix = (prefix || 'print');
  }

})

/**************************** outlets/inlets *********************************/
var InletInlet = portlets['inlet'].extend({
  message: function() {
    var outlet = this.obj.outlets[0]
    outlet.message.apply(outlet, arguments)
  }
})

var InletInletDsp = InletInlet.extend({
})

var OutletOutletDsp = portlets['outlet~'].extend({
  message: function() {
    var args = arguments
    // Normal dsp outlets cannot receive messages,
    // but this one just transmits them unchanged.
    this.sinks.forEach(function(sink) {
      sink.message.apply(sink, args)
    })
  }
})

var DspPortletObjectMixin = {
  init: function() {
  }
}

exports['outlet'] = PdObject.extend({
  inletDefs: [ InletInlet ],
  outletDefs: [ portlets['outlet'].extend({ crossPatch: true }) ]
})

exports['inlet'] = PdObject.extend({
  inletDefs: [ InletInlet.extend({ crossPatch: true }) ],
  outletDefs: [ portlets['outlet'] ]
})

exports['outlet~'] = PdObject.extend(DspPortletObjectMixin, {
  inletDefs: [ InletInletDsp ],
  outletDefs: [ OutletOutletDsp.extend({ crossPatch: true }) ]
})

exports['inlet~'] = PdObject.extend(DspPortletObjectMixin, {
  inletDefs: [ InletInletDsp.extend({ crossPatch: true }) ],
  outletDefs: [ OutletOutletDsp ]
})

// Set `type` attribute to objects (override the default value 'abstract')
_.pairs(exports).forEach(function(pair) {
  pair[1].prototype.type = pair[0]
})
