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
  , PdObject = require('./PdObject')

exports['osc~'] = PdObject.extend({

  init: function(freq) {
    this.osc = require('../index').WAAContext.createOscillator()
    this.osc.type = 'sine'
    this.i(0).message(freq)
  },

  start: function() {
    this.osc.start(0)
  },

  stop: function() {
    this.osc.stop(0)
  },

  inletDefs: [
    portlets['inlet'].extend({
      message: function(freq) {
        expect(freq).to.be.a('number', 'osc~::frequency')
        this.obj.osc.frequency.value = freq
      }
    })
  ],

  outletDefs: [
    portlets['outlet~'].extend({
      getWAA: function() { return [this.obj.osc, 0] }
    })
  ]

})

exports['dac~'] = PdObject.extend({

  init: function(args) {
    var WAAContext = require('../index').WAAContext
      , merger = WAAContext.createChannelMerger()
      , gainL = WAAContext.createGain()
      , gainR = WAAContext.createGain()
    merger.connect(WAAContext.destination)
    gainL.connect(merger, 0, 0)
    gainR.connect(merger, 0, 1)
    this.channels = [gainL, gainR]
  },

  inletDefs: [
    portlets['inlet~'].extend({
      getWAA: function() { return [this.obj.channels[0], 0] }
    }),
    portlets['inlet~'].extend({
      getWAA: function() { return [this.obj.channels[1], 0] }
    })
  ]

})

// Set `type` attribute to objects (override the default value 'abstract')
_.pairs(exports).forEach(function(pair) {
  pair[1].prototype.type = pair[0]
})

/*
var Pd = {

  connect: function(portlet, portlet) {
    
  }

}

Pd.createObject = function(proto, args) {

  if (!Pd.objects.hasOwnProperty(proto))
    throw new Error('unknown object ' + proto)

  var objDef = Pd.objects[proto]
    , obj = objDef.create(args)

  objDef.inlets.forEach(function(inletDef) {
    initAudioParam(obj[inletDef.name], inletDef)
  })

  return obj
}

*/
