/*
 * Copyright (c) 2011-2015 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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
  , WAAClock = require('waaclock')

// A little wrapper to WAAClock, to implement the Clock interface.
var Clock = module.exports = function(opts) {
  var self = this
  this._audioContext = opts.audioContext
  this._waaClock = opts.waaClock || new WAAClock(opts.audioContext)
  this._waaClock.start()
  Object.defineProperty(this, 'time', {
    get: function() { return self._audioContext.currentTime * 1000 }
  })
}

Clock.prototype.schedule = function(func, time, repetition) {
  var _func = function(event) {
      // In case the event is executed immediately
      if (event.timeTag == undefined)
        event.timeTag = event.deadline * 1000 
      func(event)
    }
    , event = this._waaClock.callbackAtTime(_func, time / 1000)

  Object.defineProperty(event, 'timeTag', {
    get: function() { return this.deadline * 1000 }
  })

  if (_.isNumber(repetition)) event.repeat(repetition / 1000)
  return event
}

Clock.prototype.unschedule = function(event) {
  event.clear()
}