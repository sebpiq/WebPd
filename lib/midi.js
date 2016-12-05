/*
 * Copyright (c) 2011-2015 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>, Jacob Stern <jacob.stern@outlook.com>
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
            this.o(0).message([note])
            this.o(1).message([velocity])
          }
        } else {
          this.o(0).message([note])
          this.o(1).message([velocity])   
          this.o(2).message([channel])
        }
      }
    }
  })
}