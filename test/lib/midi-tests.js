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

  dummyMidi = {
    onMessage: function(callback) {
      this._callback = callback
    },
    sendEvent: function(midiMessage) {
      this._callback(midiMessage)
    }
  }

  beforeEach(function() {
    patch = Pd.createPatch()
    Pd.start({
      midi: dummyMidi
    })
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
      notein.o(0).connect(mailbox.i(0))
      mailbox.events.once('message', function() {
        assert.equal(mailbox.received[0][0], 57)
        done()
      })
      dummyMidi.sendEvent({ data: [0x90, 57, 77] })
    })
  })

  describe('[poly]', function() {
    it('should distribute simultaneous messages among different voices', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])

      assert.equal(mailbox1.received[0][0], 1)
      assert.equal(mailbox2.received[0][0], 60)
      assert.equal(mailbox3.received[0][0], 64)

      poly.i(1).message([64])
      poly.i(0).message([62])

      assert.equal(mailbox1.received[1][0], 2)
      assert.equal(mailbox2.received[1][0], 62)
      assert.equal(mailbox3.received[1][0], 64)

      poly.i(1).message([64])
      poly.i(0).message([64])

      assert.equal(mailbox1.received[2][0], 3)
      assert.equal(mailbox2.received[2][0], 64)
      assert.equal(mailbox3.received[2][0], 64)
    })

    it('should send off messages when velocity is zero', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([0])
      poly.i(0).message([62])

      assert.equal(mailbox1.received[2][0], 2)
      assert.equal(mailbox2.received[2][0], 62)
      assert.equal(mailbox3.received[2][0], 0)

      poly.i(1).message([64])
      poly.i(0).message([64])
      poly.i(1).message([0])
      poly.i(0).message([64])

      assert.equal(mailbox1.received[4][0], 3)
      assert.equal(mailbox2.received[4][0], 64)
      assert.equal(mailbox3.received[4][0], 0)
    })

    it('should not send off messages if the note is not playing', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([0])
      poly.i(0).message([62])
      poly.i(1).message([0])
      poly.i(0).message([62])

      assert.equal(mailbox1.received.length, 3)
      assert.equal(mailbox2.received.length, 3)
      assert.equal(mailbox3.received.length, 3)
    })

    it('should rotate among available voices', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([0])
      poly.i(0).message([62])
      poly.i(1).message([60])
      poly.i(0).message([66])
      poly.i(1).message([58])
      poly.i(0).message([62])

      assert.equal(mailbox1.received[3][0], 3)
      assert.equal(mailbox2.received[3][0], 66)
      assert.equal(mailbox3.received[3][0], 60)
      assert.equal(mailbox1.received[4][0], 2)
      assert.equal(mailbox2.received[4][0], 62)
      assert.equal(mailbox3.received[4][0], 58)
    })

    it('should not steal voices if voice stealing is disabled', function() {
      var poly = patch.createObject('poly', [3, 0])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([60])
      poly.i(0).message([64])
      // Voices are now saturated
      poly.i(1).message([64])
      poly.i(0).message([58])
      poly.i(1).message([64])
      poly.i(0).message([42])

      assert.equal(mailbox1.received[2][0], 3)
      assert.equal(mailbox2.received[2][0], 64)
      assert.equal(mailbox3.received[2][0], 60)
      assert.equal(mailbox1.received.length, 3)
      assert.equal(mailbox2.received.length, 3)
      assert.equal(mailbox3.received.length, 3)
    })

    it('should disable voice stealing by default', function() {
      var poly = patch.createObject('poly', [1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])

      assert.equal(mailbox1.received.length, 1)
      assert.equal(mailbox2.received.length, 1)
      assert.equal(mailbox3.received.length, 1)
    })

    it('should implement voice stealing for a single voice', function() {
      var poly = patch.createObject('poly', [1, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')

      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([64])
      poly.i(0).message([66])

      assert.equal(mailbox1.received[0][0], 1)
      assert.equal(mailbox2.received[0][0], 60)
      assert.equal(mailbox3.received[0][0], 64)
      assert.equal(mailbox1.received[1][0], 1)
      assert.equal(mailbox2.received[1][0], 60)
      assert.equal(mailbox3.received[1][0], 0)
      assert.equal(mailbox1.received[2][0], 1)
      assert.equal(mailbox2.received[2][0], 62)
      assert.equal(mailbox3.received[2][0], 64)
      assert.equal(mailbox1.received[3][0], 1)
      assert.equal(mailbox2.received[3][0], 62)
      assert.equal(mailbox3.received[3][0], 0)
      assert.equal(mailbox1.received[4][0], 1)
      assert.equal(mailbox2.received[4][0], 66)
      assert.equal(mailbox3.received[4][0], 64)
    })

    it('should implement voice stealing for multiple voices', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([60])
      poly.i(0).message([64])
      poly.i(1).message([64])
      poly.i(0).message([58])
      poly.i(1).message([64])
      poly.i(0).message([42])

      assert.equal(mailbox1.received[2][0], 3)
      assert.equal(mailbox2.received[2][0], 64)
      assert.equal(mailbox3.received[2][0], 60)
      assert.equal(mailbox1.received[3][0], 1)
      assert.equal(mailbox2.received[3][0], 60)
      assert.equal(mailbox3.received[3][0], 0)
      assert.equal(mailbox1.received[4][0], 1)
      assert.equal(mailbox2.received[4][0], 58)
      assert.equal(mailbox3.received[4][0], 64)
      assert.equal(mailbox1.received[5][0], 2)
      assert.equal(mailbox2.received[5][0], 62)
      assert.equal(mailbox3.received[5][0], 0)
      assert.equal(mailbox1.received[6][0], 2)
      assert.equal(mailbox2.received[6][0], 42)
      assert.equal(mailbox3.received[6][0], 64)
    })

    it('should steal the oldest voice', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([60])
      poly.i(0).message([64])
      poly.i(1).message([0])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([58])

      assert.equal(mailbox1.received[4][0], 1)
      assert.equal(mailbox2.received[4][0], 60)
      assert.equal(mailbox3.received[4][0], 64)
      assert.equal(mailbox1.received[5][0], 2)
      assert.equal(mailbox2.received[5][0], 62)
      assert.equal(mailbox3.received[5][0], 0)
      assert.equal(mailbox1.received[6][0], 2)
      assert.equal(mailbox2.received[6][0], 58)
      assert.equal(mailbox3.received[6][0], 64)
    })

    it('should work as expected when connected to a [notein]', function() {
      var notein = patch.createObject('notein', [])
        , poly = patch.createObject('poly', [3])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      notein.o(0).connect(poly.i(0))
      notein.o(1).connect(poly.i(1))
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))
      
      pdGlob.emitter.emit('midiMessage', { data: [0x90, 57, 40] })
      pdGlob.emitter.emit('midiMessage', { data: [0x93, 64, 77] })

      assert.equal(mailbox1.received[0][0], 1)
      assert.equal(mailbox2.received[0][0], 57)
      assert.equal(mailbox3.received[0][0], 40)
      assert.equal(mailbox1.received[1][0], 2)
      assert.equal(mailbox2.received[1][0], 64)
      assert.equal(mailbox3.received[1][0], 77)
    })

    it('should preserve a time tag from the input args', function() {
      var poly = patch.createObject('poly', [1, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , timeTags = [Math.random(), Math.random()]
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))

      poly.i(1).message(utils.timeTag([64], timeTags[0]))
      poly.i(0).message(utils.timeTag([60], timeTags[0]))
      poly.i(1).message(utils.timeTag([64], timeTags[1]))
      poly.i(0).message(utils.timeTag([62], timeTags[1]))

      assert.equal(mailbox1.rawReceived[0].timeTag, timeTags[0])
      assert.equal(mailbox2.rawReceived[0].timeTag, timeTags[0])
      assert.equal(mailbox2.rawReceived[1].timeTag, timeTags[1])
      assert.equal(mailbox2.rawReceived[1].timeTag, timeTags[1])
    })

    it('should take a second array argument as velocity', function() {
      var poly = patch.createObject('poly', [3, 1])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(0).message([60, 64])

      assert.equal(mailbox1.received[0][0], 1)
      assert.equal(mailbox2.received[0][0], 60)
      assert.equal(mailbox3.received[0][0], 64)

      poly.i(0).message([62, 64])

      assert.equal(mailbox1.received[1][0], 2)
      assert.equal(mailbox2.received[1][0], 62)
      assert.equal(mailbox3.received[1][0], 64)

      poly.i(0).message([64, 64])

      assert.equal(mailbox1.received[2][0], 3)
      assert.equal(mailbox2.received[2][0], 64)
      assert.equal(mailbox3.received[2][0], 64)
    })

    it('should cancel all notes when it receives a \'stop\' message', function() {
      var poly = patch.createObject('poly', [3, 0])
        , mailbox1 = patch.createObject('testingmailbox')
        , mailbox2 = patch.createObject('testingmailbox')
        , mailbox3 = patch.createObject('testingmailbox')
      poly.o(0).connect(mailbox1.i(0))
      poly.o(1).connect(mailbox2.i(0))
      poly.o(2).connect(mailbox3.i(0))

      poly.i(1).message([64])
      poly.i(0).message([60])
      poly.i(1).message([64])
      poly.i(0).message([62])
      poly.i(1).message([60])
      poly.i(0).message([64])
      poly.i(0).message(['stop'])
      poly.i(0).message([61, 55])

      assert.equal(mailbox1.received[2][0], 3)
      assert.equal(mailbox2.received[2][0], 64)
      assert.equal(mailbox3.received[2][0], 60)
      assert.equal(mailbox2.received[6][0], 61)
      assert.equal(mailbox3.received[6][0], 55)

      var foundNotes = []
        , foundVoices = []
      for (var i = 3; i < 6; i++) {
        foundVoices.push(mailbox1.received[i][0])
        foundNotes.push(mailbox2.received[i][0])
        assert.equal(mailbox3.received[i][0], 0)
      }
      assert.deepEqual(foundVoices.sort(), [1, 2, 3])
      assert.deepEqual(foundNotes.sort(), [60, 62, 64])

      assert.equal(mailbox1.received.length, 7)
      assert.equal(mailbox2.received.length, 7)
      assert.equal(mailbox3.received.length, 7)
    })
  })

  it('should reset its memory when it receives a \'clear\' message', function() {
    var poly = patch.createObject('poly', [3, 0])
      , mailbox1 = patch.createObject('testingmailbox')
      , mailbox2 = patch.createObject('testingmailbox')
      , mailbox3 = patch.createObject('testingmailbox')
    poly.o(0).connect(mailbox1.i(0))
    poly.o(1).connect(mailbox2.i(0))
    poly.o(2).connect(mailbox3.i(0))

    poly.i(1).message([64])
    poly.i(0).message([60])
    poly.i(1).message([64])
    poly.i(0).message([62])
    poly.i(1).message([60])
    poly.i(0).message([64])
    poly.i(0).message(['clear'])
    poly.i(0).message([61, 55])

    assert.equal(mailbox1.received[2][0], 3)
    assert.equal(mailbox2.received[2][0], 64)
    assert.equal(mailbox3.received[2][0], 60)
    assert.equal(mailbox2.received[3][0], 61)
    assert.equal(mailbox3.received[3][0], 55)

    assert.equal(mailbox1.received.length, 4)
    assert.equal(mailbox2.received.length, 4)
    assert.equal(mailbox3.received.length, 4)
  })
})
