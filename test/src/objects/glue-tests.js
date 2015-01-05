var assert = require('assert')
  , _ = require('underscore')
  , Pd = require('../../../index')
  , Patch = require('../../../lib/core/Patch')
  , portlets = require('../../../lib/objects/portlets')
  , pdGlob = require('../../../lib/global')
  , helpers = require('../../helpers')
  , TestingMailBox = require('./utils').TestingMailBox


describe('objects.glue', function() {  

  var patch

  beforeEach(function() {
    patch = Pd.createPatch()
    pdGlob.library['testingmailbox'] = TestingMailBox
    Pd.start()
  })

  afterEach(function() { helpers.afterEach() })

  describe('[send] / [receive]', function() {
    var send1, send2
      , receive1, receive1bis, receive2
      , mailbox1, mailbox1bis, mailbox2

    beforeEach(function() {
      send1 = patch.createObject('send', ['no1'])
      send2 = patch.createObject('send', ['no2'])

      receive1 = patch.createObject('receive', ['no1'])
      receive1bis = patch.createObject('receive', ['no1'])
      receive2 = patch.createObject('receive', ['no2'])

      mailbox1 = patch.createObject('testingmailbox')
      mailbox1bis = patch.createObject('testingmailbox')
      mailbox2 = patch.createObject('testingmailbox')

      receive1.o(0).connect(mailbox1.i(0))
      receive1bis.o(0).connect(mailbox1bis.i(0))
      receive2.o(0).connect(mailbox2.i(0))
    })

    it('should send messages through inlet to all receivers', function() {
      send1.i(0).message(['bla', 'bli', 'blu'])
      assert.deepEqual(mailbox1.received, [['bla', 'bli', 'blu']])
      assert.deepEqual(mailbox1bis.received, [['bla', 'bli', 'blu']])
      assert.deepEqual(mailbox2.received, [])
    })

    it('should send messages to Pd.receive as well', function() {
      var received = []
      Pd.receive('no2', function(args) { received.push(args) })
      Pd.send('no2', ['bla', 888])
      assert.deepEqual(mailbox1.received, [])
      assert.deepEqual(mailbox1bis.received, [])
      assert.deepEqual(mailbox2.received, [['bla', 888]])
      assert.deepEqual(received, [['bla', 888]])
    })

    it('should send messages to Pd.receive as well', function() {
      // First change only receiver name
      receive1.setName('num1')
      send1.i(0).message(['blop', 'blep', 'blup'])
      assert.deepEqual(mailbox1.received, [])

      // Then change also sender name
      send1.setName('num1')
      send1.i(0).message([1, 11, 111])
      assert.deepEqual(mailbox1.received, [[1, 11, 111]])
    })
  })

  describe('[msg]', function() {

    it('should transmits always the same message if no $-args', function() {
      var msg = patch.createObject('msg', [11, '22'])
        , mailbox = patch.createObject('testingmailbox')
      msg.o(0).connect(mailbox.i(0))

      msg.i(0).message([22])
      assert.deepEqual(mailbox.received, [[11, '22']])

      msg.i(0).message(['bang'])
      assert.deepEqual(mailbox.received, [[11, '22'], [11, '22']])

      msg.i(0).message(['bla', 123])
      assert.deepEqual(mailbox.received, [[11, '22'], [11, '22'], [11, '22']])
    })

    it('should resolve $-args', function() {
      var msg = patch.createObject('msg', ['$1', 33, '$0', '$3-HA'])
        , mailbox = patch.createObject('testingmailbox')
      msg.o(0).connect(mailbox.i(0))

      msg.i(0).message([22, 'bloblo', 44, 'blibli', 66])
      assert.deepEqual(mailbox.received, [[22, 33, 0, '44-HA']])

      msg.i(0).message(['bloblo', 'bleble', 'blybly'])
      assert.deepEqual(mailbox.received, [[22, 33, 0, '44-HA'], ['bloblo', 33, 0, 'blybly-HA']])
    })

    it('should raise an error if $-arg out of range', function() {
      var msg = patch.createObject('msg', ['$1', 33, '$0', '$3-HA'])
      assert.throws(function() { msg.i(0).message(['ouch', 'ich']) })
      assert.throws(function() { msg.i(0).message([11]) })
      assert.throws(function() { msg.i(0).message(['bang']) })
    })

  })


})
