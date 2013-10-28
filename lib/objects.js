/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

/**************************** dsp *********************************/
// TODO: dsp signal to first inlet
// TODO: phase
exports['osc~'] = PdObject.extend({

  init: function(frequency) {
    this.i(0).message(frequency)
  },

  start: function() {
    this.osc.start(0)
  },

  stop: function() {
    this.osc.stop(0)
  },

  inletDefs: [
    portlets['inlet'].extend({
      message: function(frequency) {
        expect(frequency).to.be.a('number', 'osc~::frequency')
        this.obj.frequency = frequency
      }
    })
  ],

  outletDefs: [
    portlets['outlet~'].extend({
    })
  ]

})

exports['dac~'] = PdObject.extend({

  init: function(args) {
  },

  inletDefs: [
    portlets['inlet~'].extend({
    }),
    portlets['inlet~'].extend({
    })
  ]

})

/**************************** glue *********************************/
exports['receive'] = PdObject.extend(utils.NamedMixin, {

  outletDefs: [portlets['outlet']],
  abbreviations: ['r'],

  init: function(name) {
    var onMsgReceived = this._messageHandler()
    this.on('change:name', function(oldName, newName) {
      var Pd = require('../index')
      if (oldName) Pd.removeListener('msg:' + oldName, onMsgReceived)
      Pd.on('msg:' + newName, onMsgReceived)
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
        var Pd = require('../index')
        Pd.emit.apply(Pd, ['msg:' + this.obj.name].concat(_.toArray(arguments)))
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
