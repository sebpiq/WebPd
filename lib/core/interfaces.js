// Scheduler to handle timing
exports.Clock = {

  // Current time of the clock in milliseconds
  time: 0,

  // Schedule `func` to run in `relativeTime` from now. Returns an `Event`
  schedule: function(func, relativeTime, isRepeated) {},

  // Unschedule `event`
  unschedule: function(event) {}
}

// Audio engine
exports.Audio = {

  // Start the audio
  start: function() {},

  // Stop the audio
  stop: function() {}
}