var assert = require('assert')
  , EventEmitter = require('events').EventEmitter
  , _ = require('underscore')
  , waa = require('../../../lib/waa/interfaces')

describe('waa.interfaces', function() {

  describe('Midi', function() {

    var MockMidiInput = exports.MockMidiInput = function() {
      EventEmitter.apply(this)
    }
    _.extend(MockMidiInput.prototype, EventEmitter.prototype)
    MockMidiInput.prototype.addEventListener = EventEmitter.prototype.on
    MockMidiInput.prototype.removeEventListener = EventEmitter.prototype.removeListener


    describe('.setMidiInput', function () {

      it('should register for the midimessage event listener', function() {
        var mockMidiInput = new MockMidiInput()
          , midi = new waa.Midi

        assert.equal(mockMidiInput.listenerCount('midimessage'), 0)
        midi.setMidiInput(mockMidiInput)
        assert.equal(mockMidiInput.listenerCount('midimessage'), 1)
        midi.setMidiInput(null)
      })

      it('should unregister the midimessage event listener when the value changes', function() {
        var mockInput1 = new MockMidiInput()
          , mockInput2 = new MockMidiInput()
          , midi = new waa.Midi

        midi.setMidiInput(mockInput1)
        assert.equal(mockInput1.listenerCount('midimessage'), 1)
        assert.equal(mockInput2.listenerCount('midimessage'), 0)

        midi.setMidiInput(mockInput2)
        assert.equal(mockInput1.listenerCount('midimessage'), 0)
        assert.equal(mockInput2.listenerCount('midimessage'), 1)

        midi.setMidiInput(null)
        assert.equal(mockInput1.listenerCount('midimessage'), 0)
        assert.equal(mockInput2.listenerCount('midimessage'), 0)
      })

      it('should send midimessage events to the callback', function(done) {
        var message = { data: [ 0x00, 0x00, 0x00 ] }
          , mockMidiInput = new MockMidiInput()
          , midi = new waa.Midi()

        midi.onMessage(function(midiMessage) {
          assert.equal(midiMessage, message)
          done()
        })
        midi.setMidiInput(mockMidiInput)
        mockMidiInput.emit('midimessage', message)
      })

    })

  })

})