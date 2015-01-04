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
  , Patch = require('../core/Patch')
  , pdGlob = require('../global')
  , portlets = require('./portlets')

exports.declareObjects = function(library) {

  library['receive'] = PdObject.extend(utils.NamedMixin, {

    type: 'receive',

    outletDefs: [portlets.Outlet],
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

  library['send'] = PdObject.extend(utils.NamedMixin, {

    type: 'send',

    inletDefs: [

      portlets.Inlet.extend({
        message: function() {
          pdGlob.emitter.emit.apply(pdGlob.emitter, ['msg:' + this.obj.name].concat(_.toArray(arguments)))
        }
      })

    ],

    abbreviations: ['s'],

    init: function(name) { this.setName(name) }

  })

  library['msg'] = PdObject.extend({

    type: 'msg',

    doResolveArgs: false,

    inletDefs: [

      portlets.Inlet.extend({
        message: function() {
          var outlet = this.obj.outlets[0]
            , msg = _.toArray(arguments)
          // For some reason in Pd $0 in a message is always 0.
          msg.unshift(0)
          outlet.message.apply(outlet, this.obj.resolver(msg))
        }
      })

    ],

    outletDefs: [portlets.Outlet],

    init: function() {
      this.resolver = utils.getDollarResolver(_.toArray(arguments))
    }

  })

  library['print'] = PdObject.extend({

    type: 'print',

    inletDefs: [

      portlets.Inlet.extend({
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

  library['pd'] = Patch

}
