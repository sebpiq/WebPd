var assert = require('assert')
  , _ = require('underscore')
  , async = require('async')
  , helpers = require('../helpers')
  , waa = require('../../lib/waa/interfaces')


describe('waa', function() {

  describe('Clock', function() {

    it('should implement `Clock.time` properly', function() {
      var audioContext = new OfflineAudioContext(2, 44100, 44100)
        , clock = new waa.Clock({ audioContext: audioContext })
      assert.equal(clock.time, audioContext.currentTime * 1000)
    })

    it('should implement `Clock.schedule` properly', function() {
      var audioContext = new OfflineAudioContext(2, 44100, 44100)
        , clock = new waa.Clock({ audioContext: audioContext })
        , event1 = clock.schedule(function() {}, 1000, 500)
        , event2 = clock.schedule(function(event) {
          assert.equal(event.timeTag, event.deadline * 1000)
          event.executed = true 
        }, 0)
      
      // Check that event has a timeTag
      assert.equal(event1.timeTag, 1000)

      // Check that event is executed immediately if scheduled for "now".
      assert.equal(event2.executed, true)

      // Test WAAClock stuff
      assert.equal(event1.deadline, 1)
      assert.equal(event1.repeatTime, 0.5)
    })

    it('should implement `Clock.unschedule` properly', function() {
      var audioContext = new OfflineAudioContext(2, 44100, 44100)
        , clock = new waa.Clock({ audioContext: audioContext })
        , event = clock.schedule(function() {}, 1000, 500)
      clock.unschedule(event)

      // Test WAAClock stuff
      assert.equal(clock._waaClock._events.length, 0)
    })

  })

})