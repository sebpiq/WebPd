var _ = require('underscore')
  , assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , waatest = require('waatest')
  , portlets = require('../lib/objects/portlets')
  , PdObject = require('../lib/core/PdObject')
  , Pd = require('../index')
  , pdGlob = require('../lib/global')
  , utils = require('../lib/core/utils')

exports.afterEach = function() {
  pdGlob.namedObjects.reset()
  pdGlob.patches = {}
  pdGlob.library = {}
  require('../lib/objects').declareObjects(pdGlob.library)
  Pd.stop()
}

exports.beforeEach = function() {
  pdGlob.library['testingmailbox'] = TestingMailBox
}

exports.expectSamples = function(onStarted, expected, done) {
  waatest.utils.expectSamples(function(context) {
    var channelCount = expected.length
      , audio = new TestAudio(channelCount, context)
    Pd.start({audio: audio})
    onStarted()
  }, expected, function(err) {
    Pd.stop()
    done(err)
  })
}

exports.renderSamples = function(channelCount, frameCount, onStarted, done) {
  waatest.utils.renderSamples(channelCount, frameCount, function(context) {
    var audio = new TestAudio(channelCount, context)
    Pd.start(audio)
    onStarted()
  }, function(err, block) {
    Pd.stop()
    done(err, block)
  })
}

var TestingMailBox = exports.TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() {
    this.received = []
    this.events = new EventEmitter()
  },
  inletDefs: [
    portlets.Inlet.extend({
      message: function(args) {
        this.obj.outlets[0].message(args)
        this.obj.received.push(args)
        this.obj.events.emit('message')
      }
    })
  ],
  outletDefs: [ portlets.Outlet ]
})

// Audio engine for testing
var TestAudio = function(channelCount, context) {
  var ch
  Object.defineProperty(this, 'time', {
    get: function() { return context.currentTime * 1000 }
  })
  this.context = context
  this._channelMerger = this.context.createChannelMerger(channelCount)
  this._channelMerger.connect(this.context.destination)
  this.channels = []
  for (ch = 0; ch < channelCount; ch++) {
    this.channels.push(this.context.createGain())
    this.channels[ch].connect(this._channelMerger, 0, ch)
  }
}
TestAudio.prototype.start = function() {}
TestAudio.prototype.stop = function() {}

var TestClock = exports.TestClock = function() {
  this.events = []
  this.time = 0
}
TestClock.prototype.schedule = function(func, time, repetition) {
  var event = { func: func, time: time, repetition: repetition }
  this.events.push(event)
  if (event.time === this.time) event.func()
  return event
}
TestClock.prototype.unschedule = function(event) { this.events = _.without(this.events, event) },
TestClock.prototype.tick = function() {
  var self = this
  this.events.forEach(function(e) {
    if (e.repetition) {
      if (self.time >= e.time && ((self.time - e.time) % e.repetition) === 0) e.func()
    } else if (e.time === self.time) e.func()
  })
}