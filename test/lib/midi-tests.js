var assert = require('assert')
  , path = require('path')
  , fs = require('fs')
  , _ = require('underscore')
  , waatest = require('waatest')
  , Pd = require('../../index')
  , utils = require('../../lib/core/utils')
  , PdObject = require('../../lib/core/PdObject')
  , Patch = require('../../lib/core/Patch')
  , portlets = require('../../lib/waa/portlets')
  , pdGlob = require('../../lib/global')
  , helpers = require('../helpers')

describe('midi', function() {  

  var patch

  var dummyAudio = {
    start: function() {},
    stop: function() {},
    decode: function(audioData, done) { done(null, audioData) },
    sampleRate: 44100
  }

  var dummyStorage = {
    get: function(uri, done) {
      if (this.data !== null) done(null, this.data)
      else done(new Error('bla'), null)
    },
    data: [new Float32Array([1, 2, 3, 4])]
  }

  beforeEach(function() {
    patch = Pd.createPatch()
    Pd.start({ audio: dummyAudio, storage: dummyStorage })
    helpers.beforeEach()
  })

  afterEach(function() { 
    patch.destroy()
    helpers.afterEach() 
  })


  describe('[notein]', function() {

    it('should send note, velocity, and channel if there are no args', function() {
      var notein = patch.createObject('notein', [])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      notein.o(0).connect(mailbox1.i(0))
      notein.o(1).connect(mailbox2.i(0))
      notein.o(2).connect(mailbox3.i(0))

      pdGlob.emitter.emit('midiMessage', { data: [0x90, 57, 77] })
      assert.equal(mailbox1.received[0][0], 57)
      assert.equal(mailbox2.received[0][0], 77)
      assert.equal(mailbox3.received[0][0], 1)

      pdGlob.emitter.emit('midiMessage', { data: [0x93, 57, 77] })
      assert.equal(mailbox1.received[1][0], 57)
      assert.equal(mailbox2.received[1][0], 77)
      assert.equal(mailbox3.received[1][0], 4)

      pdGlob.emitter.emit('midiMessage', { data: [0x80, 57, 0] })
      assert.equal(mailbox1.received[2][0], 57)
      assert.equal(mailbox2.received[2][0], 0)
      assert.equal(mailbox3.received[2][0], 1)
    })

    it('should send note and velocity if channel is specified', function() {
      var notein = patch.createObject('notein', [1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      notein.o(0).connect(mailbox1.i(0))
      notein.o(1).connect(mailbox2.i(0))
      notein.o(2).connect(mailbox3.i(0))

      pdGlob.emitter.emit('midiMessage', { data: [0x90, 57, 77] })
      assert.equal(mailbox1.received[0][0], 57)
      assert.equal(mailbox2.received[0][0], 77)
      assert.equal(mailbox3.received.length, 0)

      pdGlob.emitter.emit('midiMessage', { data: [0x93, 57, 77] })
      assert.equal(mailbox1.received.length, 1)
      assert.equal(mailbox2.received.length, 1)
      assert.equal(mailbox3.received.length, 0)
    })

    it('should not send messages that are not note messages', function() {
      var notein = patch.createObject('notein', [])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      notein.o(0).connect(mailbox1.i(0))
      notein.o(1).connect(mailbox2.i(0))
      notein.o(2).connect(mailbox3.i(0))

      pdGlob.emitter.emit('midiMessage', { data: [0xA0, 57, 77] })
      assert.equal(mailbox1.received.length, 0)
      assert.equal(mailbox2.received.length, 0)
      assert.equal(mailbox3.received.length, 0)

      // Clock message, not sure if Web MIDI supports this?
      pdGlob.emitter.emit('midiMessage', { data: [248] })
      assert.equal(mailbox1.received.length, 0)
      assert.equal(mailbox2.received.length, 0)
      assert.equal(mailbox3.received.length, 0)
    })

    it('should send midi messages from Pd.setMidiInput', function(done) {
      var notein = patch.createObject('notein', [])
        , mailbox = patch.createObject('testingmailbox')
        , mockMidiInput = new helpers.MockMidiInput()
      notein.o(0).connect(mailbox.i(0))
      mailbox.events.once('message', function() {
        assert.equal(mailbox.received[0][0], 57)
        done()
      })
      Pd.setMidiInput(mockMidiInput)
      mockMidiInput.sendEvent({ data: [0x90, 57, 77] })
    })
  })
})
