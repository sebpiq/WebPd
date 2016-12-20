var _ = require('underscore')
  , assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , waatest = require('waatest')
  , portlets = require('../lib/waa/portlets')
  , PdObject = require('../lib/core/PdObject')
  , Pd = require('../index')
  , pdGlob = require('../lib/global')
  , utils = require('../lib/core/utils')

exports.afterEach = function() {
  pdGlob.namedObjects.reset()
  pdGlob.patches = {}
  pdGlob.library = {}
  require('../lib').declareObjects(pdGlob.library)
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
    Pd.start({audio: audio})
    onStarted()
  }, function(err, block) {
    Pd.stop()
    done(err, block)
  })
}

exports.assertPreservesTimeTag = function(pdObject, args) {
  var mailbox = pdObject.patch.createObject('testingmailbox')
    , timeTag = Math.random()
  utils.timeTag(args, timeTag)
  pdObject.o(0).connect(mailbox.i(0))
  pdObject.i(0).message(args)
  assert.equal(mailbox.rawReceived[0].timeTag, timeTag)
}

var TestingMailBox = exports.TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() {
    this.received = []
    this.rawReceived = []
    this.events = new EventEmitter()
  },
  inletDefs: [
    portlets.Inlet.extend({
      message: function(args) {
        this.obj.outlets[0].message(args)
        this.obj.rawReceived.push(args)
        this.obj.received.push(args.slice(0))
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
  this.sampleRate = context.sampleRate
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
  var event = { func: func, timeTag: time, repetition: repetition }
  this.events.push(event)
  if (event.timeTag === this.time) event.func(event)
  return event
}

TestClock.prototype.unschedule = function(event) { this.events = _.without(this.events, event) }

TestClock.prototype.tick = function() {
  var self = this
  this.events.forEach(function(e) {
    if (e.repetition) {
      if (self.time >= e.timeTag && ((self.time - e.timeTag) % e.repetition) === 0) { 
        var e = _.extend(e, { timeTag: self.time })
        e.func(e)
      }
    } else if (e.timeTag === self.time) e.func(e)
  })
}
