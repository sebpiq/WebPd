var WAAClock = require('waaclock')

// A little wrapper to WAAClock, to implement the Clock interface.
var Clock = module.exports = function(config) {
  var self = this
  this._audioContext = config.audioContext
  this._waaClock = new WAAClock(config.audioContext)
  this._waaClock.start()
  Object.defineProperty(this, 'time', {
    get: function() { return self._audioContext.currentTime * 1000 }
  })
}

Clock.prototype.schedule = function(func, relativeTime, isRepeated) {
  return this._waaClock.setTimeout(func, relativeTime)
}

Clock.prototype.unschedule = function(event) {
  event.clear()
}